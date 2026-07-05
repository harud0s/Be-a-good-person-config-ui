/**
 * Cloudflare Worker for 快逃ゼロ PWA Editor GitHub Proxy
 */

export interface Env {
  GITHUB_PAT: string;
  TEAM_PASSWORD: string;
}

const ALLOWED_FILES = [
  'event_sequence.json',
  'pending_decisions.json',
  'normal_events.json',
  'sudden_events.json',
  'goal_cards.json',
  'skill_cards.json',
  'exam_events.json',
  'character_config.json',
  'deck_exam.json',
  'deck_lesson.json',
  'deck_rest.json',
  'ending_conditions.json',
  'game_config.json'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // For development, allow *. In production, replace with actual PWA URL.
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/files' && request.method === 'GET') {
        return await handleGetFiles(request, env, url);
      } else if (path === '/history' && request.method === 'GET') {
        return await handleGetHistory(request, env, url);
      } else if (path === '/commit' && request.method === 'POST') {
        return await handlePostCommit(request, env);
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), { status: 500, headers: CORS_HEADERS });
    }
  },
};

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

async function handleGetFiles(request: Request, env: Env, url: URL): Promise<Response> {
  const repo = url.searchParams.get('repo');
  if (!repo) return new Response(JSON.stringify({ error: 'Missing repo parameter' }), { status: 400, headers: CORS_HEADERS });

  // Use Promise.allSettled to fetch all allowed files concurrently
  const fetchPromises = ALLOWED_FILES.map(async (fileName) => {
    const githubUrl = `https://api.github.com/repos/${repo}/contents/${fileName}`;
    const res = await fetch(githubUrl, {
      headers: {
        'Authorization': `token ${env.GITHUB_PAT}`,
        'User-Agent': 'Cloudflare-Worker-Proxy',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${fileName}: ${res.status}`);
    }

    const data = await res.json() as any;
    if (data.type !== 'file') throw new Error(`${fileName} is not a file`);

    // Decode base64 content
    const contentString = decodeURIComponent(escape(atob(data.content)));

    let metaDescription = '';
    try {
      const parsed = JSON.parse(contentString);
      metaDescription = parsed._meta?.description || '';
    } catch (e) {}

    return {
      name: fileName,
      path: fileName,
      sha: data.sha,
      metaDescription,
      originalContent: contentString
    };
  });

  const results = await Promise.allSettled(fetchPromises);
  const files: any[] = [];
  const errors: string[] = [];

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      files.push(result.value);
    } else {
      errors.push(`File ${ALLOWED_FILES[idx]} error: ${result.reason}`);
    }
  });

  return new Response(JSON.stringify({ files, errors }), { status: 200, headers: CORS_HEADERS });
}

async function handleGetHistory(request: Request, env: Env, url: URL): Promise<Response> {
  const repo = url.searchParams.get('repo');
  const path = url.searchParams.get('path');
  
  if (!repo || !path) return new Response(JSON.stringify({ error: 'Missing repo or path parameter' }), { status: 400, headers: CORS_HEADERS });
  if (!ALLOWED_FILES.includes(path)) return new Response(JSON.stringify({ error: 'Path not allowed' }), { status: 403, headers: CORS_HEADERS });

  const githubUrl = `https://api.github.com/repos/${repo}/commits?path=${path}&per_page=5`;
  const res = await fetch(githubUrl, {
    headers: {
      'Authorization': `token ${env.GITHUB_PAT}`,
      'User-Agent': 'Cloudflare-Worker-Proxy',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Failed to fetch history: ${res.status}` }), { status: res.status, headers: CORS_HEADERS });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), { status: 200, headers: CORS_HEADERS });
}

async function handlePostCommit(request: Request, env: Env): Promise<Response> {
  let body;
  try {
    body = await request.json() as any;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: CORS_HEADERS });
  }

  const { password, repo, changes, commitMessage, authorName } = body;

  // 1. Password Check
  if (password !== env.TEAM_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid password' }), { status: 401, headers: CORS_HEADERS });
  }

  // 2. Validation
  if (!repo || !changes || !Array.isArray(changes) || changes.length === 0 || !commitMessage || !authorName) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: CORS_HEADERS });
  }

  for (const change of changes) {
    if (!ALLOWED_FILES.includes(change.fileName) || change.fileName.includes('../') || change.fileName.includes('/')) {
      return new Response(JSON.stringify({ error: `File not allowed or path invalid: ${change.fileName}` }), { status: 403, headers: CORS_HEADERS });
    }
  }

  // 3. GitHub Git Database API - Atomic Commit
  const headers = {
    'Authorization': `token ${env.GITHUB_PAT}`,
    'User-Agent': 'Cloudflare-Worker-Proxy',
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  try {
    // a. Get current ref (assume main branch)
    const branch = 'main'; // Alternatively, pass from frontend
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, { headers });
    if (!refRes.ok) {
      const errText = await refRes.text();
      throw new Error(`Failed to get reference: ${errText}`);
    }
    const refData = await refRes.json() as any;
    const baseCommitSha = refData.object.sha;

    // b. Get base tree
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${baseCommitSha}`, { headers });
    if (!commitRes.ok) {
      const errText = await commitRes.text();
      throw new Error(`Failed to get commit: ${errText}`);
    }
    const commitData = await commitRes.json() as any;
    const baseTreeSha = commitData.tree.sha;

    // c. Create blobs for all changed files
    const newTreeItems = [];
    for (const change of changes) {
      const blobRes = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: change.content,
          encoding: 'utf-8'
        })
      });
      if (!blobRes.ok) {
        const errText = await blobRes.text();
        throw new Error(`Failed to create blob for ${change.fileName}: ${errText}`);
      }
      const blobData = await blobRes.json() as any;
      
      newTreeItems.push({
        path: change.fileName,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    // d. Create new tree
    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: newTreeItems
      })
    });
    if (!treeRes.ok) {
      const errText = await treeRes.text();
      throw new Error(`Failed to create tree: ${errText}`);
    }
    const treeData = await treeRes.json() as any;
    const newTreeSha = treeData.sha;

    // e. Create new commit
    const finalCommitMessage = `[System] ${commitMessage} by ${authorName}`;
    const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: finalCommitMessage,
        tree: newTreeSha,
        parents: [baseCommitSha]
      })
    });
    if (!newCommitRes.ok) {
      const errText = await newCommitRes.text();
      throw new Error(`Failed to create commit: ${errText}`);
    }
    const newCommitData = await newCommitRes.json() as any;
    const newCommitFinalSha = newCommitData.sha;

    // f. Update ref
    const updateRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitFinalSha,
        force: false
      })
    });
    if (!updateRefRes.ok) {
      const errText = await updateRefRes.text();
      throw new Error(`Failed to update reference: ${errText}`);
    }

    // Return the new SHAs for each file. Since the blob SHA is the file SHA!
    const updatedFiles = newTreeItems.map(item => ({
      fileName: item.path,
      sha: item.sha
    }));

    return new Response(JSON.stringify({ success: true, updatedFiles, commitSha: newCommitFinalSha }), { status: 200, headers: CORS_HEADERS });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}
