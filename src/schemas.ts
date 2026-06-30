import { z } from 'zod';

const nullableString = z.preprocess((val) => {
  if (typeof val === 'string' && val.trim() === '') return null;
  return val;
}, z.string().nullable().optional());

const optionalNumber = z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    if (val.trim() === '') return null;
    const num = Number(val);
    if (!isNaN(num)) return num;
  }
  return val;
}, z.number({ message: "必須為數字" }).nullable().optional());

const strictNumber = z.preprocess((val) => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    if (val.trim() === '') return undefined;
    const num = Number(val);
    if (!isNaN(num)) return num;
  }
  return val;
}, z.number({ message: "必須為數字" }));

const numberOrString = z.preprocess((val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    if (val.trim() === '') return null;
    const num = Number(val);
    if (!isNaN(num)) return num;
  }
  return val;
}, z.union([z.number({ message: "必須為數字" }), z.string()]).nullable().optional());


export const baseMetaSchema = z.object({
  file: z.string().min(1, "必填"),
  version: z.string().min(1, "必填"),
  description: z.string().min(1, "必填"),
}).catchall(z.any());

export const auctionConfigSchema = z.object({
  start_cost: strictNumber,
  step: strictNumber,
  min_cost: strictNumber,
});

export const gameConfigSchema = z.object({
  _meta: baseMetaSchema,
  initial_hp: strictNumber,
  initial_aca: strictNumber,
  initial_exp: strictNumber,
  vacation_hp_gain: strictNumber,
  vacation_skill_draw: strictNumber,
  total_event_nodes: strictNumber,
  hp_death_check_timing: z.string(),
  devil_initial_face_down: z.boolean(),
  devil_win_threshold_formula: z.string(),
  qualifier_fallback_aca_threshold: strictNumber,
  science_fair_auction: auctionConfigSchema,
  intl_science_fair_auction: auctionConfigSchema,
});

export const rankRewardSchema = z.object({
  rank: strictNumber,
  aca_reward: strictNumber,
  exp_reward: strictNumber.optional(),
});

export const examEventSchema = z.object({
  exam_id: z.string().min(1, "必填"),
  exam_name: z.string().min(1, "必填"),
  exam_type: z.enum(['bid', 'olympiad', 'dutch_auction', 'qualifier']),
  hp_cost: nullableString,
  bid: z.object({
    min_bet: strictNumber,
    max_bet_cap: optionalNumber,
    note: nullableString,
    ranks: z.array(rankRewardSchema),
    tie_break_rule: z.string(),
    tie_break_note: nullableString,
  }).optional(),
  olympiad: z.object({
    min_bet: strictNumber,
    max_bet_cap: optionalNumber,
    note: nullableString,
    threshold_dice: z.string(),
    pass_condition: z.string(),
    aca_reward_on_pass: strictNumber,
  }).optional(),
  dutch_auction: z.object({
    note: nullableString,
    start_cost: strictNumber,
    step: strictNumber,
    min_cost: strictNumber,
    max_winners: strictNumber,
    ranks: z.array(rankRewardSchema),
    tie_break_rule: z.string(),
    tie_break_note: nullableString,
  }).optional(),
  qualifier: z.object({
    note: nullableString,
    threshold_source: z.string(),
    fallback_threshold: strictNumber,
    fallback_condition: z.string(),
    pass_condition: z.string(),
    pass_effect: z.object({ hp_delta: numberOrString, exp_reward: strictNumber, note: nullableString }),
    fail_effect: z.object({ hp_delta: numberOrString, exp_reward: strictNumber, note: nullableString }),
    devil_immunity: z.boolean(),
  }).optional(),
});

export const examEventsFileSchema = z.object({
  _meta: baseMetaSchema,
  exams: z.array(examEventSchema),
});

export const eventSequenceNodeSchema = z.object({
  index: strictNumber,
  display_name: z.string(),
  type: z.enum(['start', 'normal', 'exam', 'sudden', 'vacation', 'final']),
  event_id: nullableString,
  year: strictNumber,
  semester: z.string(),
  is_fixed_sudden: z.boolean(),
  note: nullableString,
});

export const eventSequenceFileSchema = z.object({
  _meta: baseMetaSchema,
  sequence: z.array(eventSequenceNodeSchema),
});

export const goalCardSchema = z.object({
  goal_id: z.string().min(1, "必填"),
  goal_name: z.string().min(1, "必填"),
  exam_score_ref: optionalNumber,
  exp_threshold: strictNumber,
  aca_threshold: strictNumber,
  hp_floor: strictNumber,
  max_hp: strictNumber,
  lives: strictNumber,
  reveal_on_death: z.boolean(),
  is_devil: z.boolean(),
  devil_win_condition: nullableString,
  note: nullableString,
  devil_revival_note: nullableString,
});

export const goalCardsFileSchema = z.object({
  _meta: baseMetaSchema,
  goal_cards: z.array(goalCardSchema),
  elimination_note: nullableString,
});

export const normalEventOptionSchema = z.object({
  option_index: strictNumber,
  label: nullableString,
  exp_delta: strictNumber,
  aca_delta: strictNumber,
  hp_delta: strictNumber,
  triggers_sudden: z.boolean(),
  dice_type: nullableString,
  dice_formula: nullableString,
  note: nullableString,
});

export const normalEventSchema = z.object({
  event_id: z.string().min(1, "必填"),
  event_name: z.string().min(1, "必填"),
  options: z.array(normalEventOptionSchema),
});

export const normalEventsFileSchema = z.object({
  _meta: baseMetaSchema,
  events: z.array(normalEventSchema),
});

export const skillCardSchema = z.object({
  card_id: z.string().min(1, "必填"),
  card_name: z.string().min(1, "必填"),
  timing: z.string(),
  target_type: z.string(),
  effect_type: z.string(),
  effect_value: strictNumber,
  dice_type: nullableString,
  can_be_countered: z.boolean().nullable().optional(),
  count_in_deck: strictNumber,
  skip_scope: nullableString,
  usage_condition: nullableString,
  chain_priority: strictNumber,
  description_ui: z.string(),
  note: nullableString,
});

export const skillCardsFileSchema = z.object({
  _meta: baseMetaSchema,
  skill_cards: z.array(skillCardSchema),
  env_effect_note: nullableString,
});

export const suddenEventOptionSchema = z.object({
  option_index: strictNumber,
  label: nullableString,
  exp_delta: strictNumber,
  aca_delta: strictNumber,
  hp_delta: strictNumber,
  skip_turns: strictNumber,
  skip_scope: nullableString,
  dice_effect: nullableString,
});

export const suddenEventSchema = z.object({
  event_id: z.string().min(1, "必填"),
  event_name: z.string().min(1, "必填"),
  has_choice: z.boolean(),
  options: z.array(suddenEventOptionSchema),
  note: nullableString,
});

export const suddenEventsFileSchema = z.object({
  _meta: baseMetaSchema,
  sudden_events: z.array(suddenEventSchema),
  env_effect_note: nullableString,
});

export const pendingDecisionSchema = z.object({
  id: strictNumber,
  status: z.enum(['OPEN', 'DECIDED', 'WONTFIX']),
  question: z.string(),
  affects: z.array(z.string()),
  suggested_default: z.string(),
  decision: nullableString,
  decided_by: nullableString,
});

export const pendingDecisionsFileSchema = z.object({
  _meta: baseMetaSchema,
  decisions: z.array(pendingDecisionSchema),
});

// A master map to resolve schema by filename
export const schemaMap: Record<string, any> = {
  'game_config.json': gameConfigSchema,
  'exam_events.json': examEventsFileSchema,
  'event_sequence.json': eventSequenceFileSchema,
  'goal_cards.json': goalCardsFileSchema,
  'normal_events.json': normalEventsFileSchema,
  'skill_cards.json': skillCardsFileSchema,
  'sudden_events.json': suddenEventsFileSchema,
  'pending_decisions.json': pendingDecisionsFileSchema,
};

export function getSchemaForFile(filename: string): any {
  return schemaMap[filename];
}

export function getSchemaForForm(filename: string, isItem: boolean): any {
  const fileSchema = schemaMap[filename];
  if (!fileSchema) return undefined;
  if (!isItem) return fileSchema;
  
  if (fileSchema.shape) {
    for (const key in fileSchema.shape) {
      if (key !== '_meta' && fileSchema.shape[key] && typeof fileSchema.shape[key] === 'object' && fileSchema.shape[key]._def?.typeName === 'ZodArray') {
        return fileSchema.shape[key].element;
      }
    }
  }
  return undefined;
}

export function getNumericKeysFromSchemaMap(map: Record<string, any>): Set<string> {
  const numericKeys = new Set<string>();
  const visited = new Set<any>();

  function traverse(schema: any, keyName?: string) {
    if (!schema || !schema._def) return;

    let current = schema;
    while (current && current._def) {
      const typeName = current._def.typeName;
      if (typeName === 'ZodEffects') {
        current = current._def.schema;
      } else if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
        current = current._def.innerType;
      } else {
        break;
      }
    }

    if (!current || !current._def) return;

    const typeName = current._def.typeName;
    if (typeName === 'ZodNumber') {
      if (keyName) numericKeys.add(keyName);
      return;
    }

    if (visited.has(current)) return;
    visited.add(current);

    if (typeName === 'ZodObject') {
      const shape = current.shape;
      for (const k in shape) {
        traverse(shape[k], k);
      }
    } else if (typeName === 'ZodArray') {
      traverse(current.element, keyName);
    } else if (typeName === 'ZodUnion') {
      current._def.options?.forEach((opt: any) => traverse(opt, keyName));
    }
  }

  for (const k in map) {
    traverse(map[k]);
  }
  return numericKeys;
}

export const NUMERIC_KEYS = getNumericKeysFromSchemaMap(schemaMap);

export function getPrimitiveArrayKeysFromSchemaMap(map: Record<string, any>): Set<string> {
  const primitiveKeys = new Set<string>();
  const visited = new Set<any>();

  function traverse(schema: any, keyName?: string) {
    if (!schema || !schema._def) return;

    let current = schema;
    while (current && current._def) {
      const typeName = current._def.typeName;
      if (typeName === 'ZodEffects') {
        current = current._def.schema;
      } else if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
        current = current._def.innerType;
      } else {
        break;
      }
    }

    if (!current || !current._def) return;
    const typeName = current._def.typeName;

    if (typeName === 'ZodArray') {
      let elem = current.element;
      while (elem && elem._def) {
        const elemTypeName = elem._def.typeName;
        if (elemTypeName === 'ZodEffects') {
          elem = elem._def.schema;
        } else if (elemTypeName === 'ZodOptional' || elemTypeName === 'ZodNullable') {
          elem = elem._def.innerType;
        } else {
          break;
        }
      }
      
      if (elem && elem._def) {
        const elemTypeName = elem._def.typeName;
        if (elemTypeName === 'ZodString' || elemTypeName === 'ZodNumber' || elemTypeName === 'ZodBoolean') {
          if (keyName) primitiveKeys.add(keyName);
          return;
        }
      }
      
      if (visited.has(current)) return;
      visited.add(current);
      
      traverse(current.element, keyName);
    } else if (typeName === 'ZodObject') {
      if (visited.has(current)) return;
      visited.add(current);

      const shape = current.shape;
      for (const k in shape) {
        traverse(shape[k], k);
      }
    } else if (typeName === 'ZodUnion') {
      if (visited.has(current)) return;
      visited.add(current);

      current._def.options?.forEach((opt: any) => traverse(opt, keyName));
    }
  }

  for (const k in map) {
    traverse(map[k]);
  }
  return primitiveKeys;
}

export const PRIMITIVE_ARRAY_KEYS = getPrimitiveArrayKeysFromSchemaMap(schemaMap);

