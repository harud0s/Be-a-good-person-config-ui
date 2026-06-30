export interface BaseMeta {
  file: string;
  version: string;
  description: string;
  [key: string]: any;
}

export interface GameConfig {
  _meta: BaseMeta;
  initial_hp: number;
  initial_aca: number;
  initial_exp: number;
  vacation_hp_gain: number;
  vacation_skill_draw: number;
  total_event_nodes: number;
  hp_death_check_timing: string;
  devil_initial_face_down: boolean;
  devil_win_threshold_formula: string;
  qualifier_fallback_aca_threshold: number;
  science_fair_auction: AuctionConfig;
  intl_science_fair_auction: AuctionConfig;
}

export interface AuctionConfig {
  start_cost: number;
  step: number;
  min_cost: number;
}

export interface RankReward {
  rank: number;
  aca_reward: number;
  exp_reward?: number;
}

export interface ExamEvent {
  exam_id: string;
  exam_name: string;
  exam_type: 'bid' | 'olympiad' | 'dutch_auction' | 'qualifier';
  hp_cost?: string;
  bid?: {
    min_bet: number;
    max_bet_cap: number | null;
    note?: string;
    ranks: RankReward[];
    tie_break_rule: string;
    tie_break_note?: string;
  };
  olympiad?: {
    min_bet: number;
    max_bet_cap: number | null;
    note?: string;
    threshold_dice: string;
    pass_condition: string;
    aca_reward_on_pass: number;
  };
  dutch_auction?: {
    note?: string;
    start_cost: number;
    step: number;
    min_cost: number;
    max_winners: number;
    ranks: RankReward[];
    tie_break_rule: string;
    tie_break_note?: string;
  };
  qualifier?: {
    note?: string;
    threshold_source: string;
    fallback_threshold: number;
    fallback_condition: string;
    pass_condition: string;
    pass_effect: { hp_delta: number | string; exp_reward: number; note?: string; };
    fail_effect: { hp_delta: number | string; exp_reward: number; note?: string; };
    devil_immunity: boolean;
  };
}

export interface ExamEventsFile {
  _meta: BaseMeta;
  exams: ExamEvent[];
}

export interface EventSequenceNode {
  index: number;
  display_name: string;
  type: 'start' | 'normal' | 'exam' | 'sudden' | 'vacation' | 'final';
  event_id: string | null;
  year: number;
  semester: string;
  is_fixed_sudden: boolean;
  note: string | null;
}

export interface EventSequenceFile {
  _meta: BaseMeta;
  sequence: EventSequenceNode[];
}

export interface GoalCard {
  goal_id: string;
  goal_name: string;
  exam_score_ref: number | null;
  exp_threshold: number;
  aca_threshold: number;
  hp_floor: number;
  max_hp: number;
  lives: number;
  reveal_on_death: boolean;
  is_devil: boolean;
  devil_win_condition: string | null;
  note: string | null;
  devil_revival_note?: string;
}

export interface GoalCardsFile {
  _meta: BaseMeta;
  goal_cards: GoalCard[];
  elimination_note?: string;
}

export interface NormalEventOption {
  option_index: number;
  label: string | null;
  exp_delta: number;
  aca_delta: number;
  hp_delta: number;
  triggers_sudden: boolean;
  dice_type: string | null;
  dice_formula: string | null;
  note?: string;
}

export interface NormalEvent {
  event_id: string;
  event_name: string;
  options: NormalEventOption[];
}

export interface NormalEventsFile {
  _meta: BaseMeta;
  events: NormalEvent[];
}

export interface SkillCard {
  card_id: string;
  card_name: string;
  timing: string;
  target_type: string;
  effect_type: string;
  effect_value: number;
  dice_type: string | null;
  can_be_countered: boolean | null;
  count_in_deck: number;
  skip_scope: string | null;
  usage_condition: string | null;
  chain_priority: number;
  description_ui: string;
  note?: string;
}

export interface SkillCardsFile {
  _meta: BaseMeta;
  skill_cards: SkillCard[];
  env_effect_note?: string;
}

export interface SuddenEventOption {
  option_index: number;
  label: string | null;
  exp_delta: number;
  aca_delta: number;
  hp_delta: number;
  skip_turns: number;
  skip_scope: string | null;
  dice_effect: string | null;
}

export interface SuddenEvent {
  event_id: string;
  event_name: string;
  has_choice: boolean;
  options: SuddenEventOption[];
  note?: string;
}

export interface SuddenEventsFile {
  _meta: BaseMeta;
  sudden_events: SuddenEvent[];
  env_effect_note?: string;
}

export interface PendingDecision {
  id: number;
  status: 'OPEN' | 'DECIDED' | 'WONTFIX';
  question: string;
  affects: string[];
  suggested_default: string;
  decision: string | null;
  decided_by: string | null;
}

export interface PendingDecisionsFile {
  _meta: BaseMeta;
  decisions: PendingDecision[];
}
