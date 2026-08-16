/**
 * Atomic actions — the ONLY way GameState ever changes.
 *
 * Two tiers, both serializable:
 *   - Moves/Intents: what a player requests ("play card 3 at enemy 1"). Validated
 *     against the rules, then expanded into atomic actions. (Added later.)
 *   - Atomic actions (below): the smallest deterministic mutations. The reducer
 *     knows how to apply each one. A card's resolved effects are a list of these.
 *
 * Every action is a plain, JSON-serializable object with a `type` discriminant.
 * The ordered log of applied actions IS the game — replay it against
 * initialState(seed) and you reproduce any state exactly.
 */
import type { CardId, CloudType, EntityId, MarkKind, ScaleMetric } from '@shared/index';
import type { PendingChoice, Phase } from '@engine/state/index';

export interface StartTurn {
  readonly type: 'StartTurn';
}

export interface EndTurn {
  readonly type: 'EndTurn';
}

/** Set the battle phase directly (mulligan/player/enemy/won/lost). */
export interface SetPhase {
  readonly type: 'SetPhase';
  readonly phase: Phase;
}

/** Clear a combatant's temporary block (done at the start of their turn). */
export interface ClearBlock {
  readonly type: 'ClearBlock';
  readonly target: EntityId;
}

/**
 * Zero the per-turn counters a combatant accumulates (today just the discard
 * count the Crab scales off). Run alongside ClearBlock at the start of a turn.
 */
export interface ClearTurnCounters {
  readonly type: 'ClearTurnCounters';
  readonly target: EntityId;
}

/**
 * Discard cards from `owner`'s hand. With `uids`, exactly those chosen copies
 * (a player's pick — see PendingChoice); without, the last `count` cards in
 * hand — the deterministic default the AI and non-interactive play use.
 */
export interface DiscardCards {
  readonly type: 'DiscardCards';
  /** Whose hand to discard from. Defaults to the player when omitted. */
  readonly owner?: EntityId;
  readonly count: number;
  /** The chosen copies. Overrides the rightmost-`count` default. */
  readonly uids?: readonly number[];
}

/**
 * Discard `owner`'s whole hand. A real discard, so it counts toward the turn's
 * discard total and sets off Molt on every card that carries it — which is the
 * point of the Crab cards that use it.
 */
export interface DiscardHand {
  readonly type: 'DiscardHand';
  /** Whose hand. Defaults to the player when omitted. */
  readonly owner?: EntityId;
}

/** Move a specific card from `owner`'s hand (by index) to their discard pile. */
export interface MoveHandCardToDiscard {
  readonly type: 'MoveHandCardToDiscard';
  /** Whose hand. Defaults to the player when omitted. */
  readonly owner?: EntityId;
  readonly index: number;
  /**
   * Why the card is leaving hand — it rides along on the `CardsDiscarded` event
   * so discard triggers can tell these apart. `'play'` (the default) is a card
   * being played; `'setup'` is the opening mulligan, which happens before the
   * battle and so must not set off Molt.
   */
  readonly reason?: 'play' | 'setup';
}

/**
 * Deal damage to one random living *opponent* (Storm cloud, etc.). Perspective
 * is set by `self`: opponents are the other side (enemies of the player, or the
 * player if `self` is an enemy). Defaults to the player's opponents when omitted.
 */
export interface DealDamageToRandomEnemy {
  readonly type: 'DealDamageToRandomEnemy';
  readonly self?: EntityId;
  readonly amount: number;
}

/**
 * Deal `multiplier × metric(self)` damage, where the metric is measured at reduce
 * time — "Deal damage equal to your energy", "Deal 3 damage for each unique cloud".
 */
export interface DealDamageScaled {
  readonly type: 'DealDamageScaled';
  readonly self: EntityId;
  readonly target: EntityId;
  readonly per: ScaleMetric;
  readonly multiplier: number;
}

/** Put a persistent (ongoing) card into a combatant's play area. */
export interface AddPersistent {
  readonly type: 'AddPersistent';
  readonly target: EntityId;
  readonly cardId: CardId;
}

export interface DrawCards {
  readonly type: 'DrawCards';
  /** Whose deck to draw from. Defaults to the player when omitted. */
  readonly owner?: EntityId;
  readonly count: number;
}

export interface DealDamage {
  readonly type: 'DealDamage';
  readonly target: EntityId;
  readonly amount: number;
  /**
   * Who is attacking. Optional because most damage doesn't care, but the Old
   * Lady's **Power** does: the first attack a combatant makes on its turn deals
   * `power` extra, which the reducer can only apply when it knows the attacker.
   * Omitting it means "no attacker" — the hit lands unbuffed.
   */
  readonly self?: EntityId;
}

/**
 * Lose HP directly — the Old Lady's cost ("Lose 1 HP, Gain 2 Power"). Distinct
 * from DealDamage on purpose: self-inflicted loss ignores block and shield, and
 * triggers that key off *being attacked* must not fire for it. Raises `HpLost`,
 * which is what "when you lose HP on your turn, gain 1 Power" (Sharpen) reads.
 */
export interface LoseHp {
  readonly type: 'LoseHp';
  readonly target: EntityId;
  readonly amount: number;
}

export interface GainBlock {
  readonly type: 'GainBlock';
  readonly target: EntityId;
  readonly amount: number;
}

/** Persistent damage soak (vs. GainBlock's temporary soak). */
export interface GainShield {
  readonly type: 'GainShield';
  readonly target: EntityId;
  readonly amount: number;
}

export interface Heal {
  readonly type: 'Heal';
  readonly target: EntityId;
  readonly amount: number;
}

export interface GainEnergy {
  readonly type: 'GainEnergy';
  readonly target: EntityId;
  readonly amount: number;
}

/** Set a combatant's energy to an exact value (used to reset to base each turn). */
export interface SetEnergy {
  readonly type: 'SetEnergy';
  readonly target: EntityId;
  readonly amount: number;
}

/** Increase a combatant's stored Poison X-value (the Wizard mechanic). */
export interface GainPoison {
  readonly type: 'GainPoison';
  readonly target: EntityId;
  readonly amount: number;
}

/** Raise (or, with a negative amount, lower) Power. Never falls below zero. */
export interface GainPower {
  readonly type: 'GainPower';
  readonly target: EntityId;
  readonly amount: number;
}

/** "You gain N Power, all opponents gain N Power" (Challenge) — the second half. */
export interface GainPowerAll {
  readonly type: 'GainPowerAll';
  readonly self: EntityId;
  readonly amount: number;
}

/** Spend all Power to heal that much (Mend). Zeroes Power either way. */
export interface ConvertPowerToHeal {
  readonly type: 'ConvertPowerToHeal';
  readonly target: EntityId;
}

export interface GainBravery {
  readonly type: 'GainBravery';
  readonly target: EntityId;
  readonly amount: number;
}

/** Create `count` clouds of one type in a combatant's cloud area. */
export interface CreateClouds {
  readonly type: 'CreateClouds';
  readonly target: EntityId;
  readonly cloudType: CloudType;
  readonly count: number;
}

/**
 * Remove up to `count` clouds. With `indices`, exactly those slots (a player's
 * pick — the design's "X clouds, your choice"); without, most-recently-created
 * first — the deterministic default.
 */
export interface RemoveClouds {
  readonly type: 'RemoveClouds';
  readonly target: EntityId;
  readonly count: number;
  /** The chosen cloud slots. Overrides the newest-first default. */
  readonly indices?: readonly number[];
}

/**
 * Create `count` clouds of randomly-chosen types. The draw runs through the
 * in-state RNG inside the reducer, so the same seed reproduces the same weather.
 */
export interface CreateRandomClouds {
  readonly type: 'CreateRandomClouds';
  readonly target: EntityId;
  readonly count: number;
}

/** Remove `count` clouds picked at random (vs RemoveClouds' newest-first). */
export interface RemoveRandomClouds {
  readonly type: 'RemoveRandomClouds';
  readonly target: EntityId;
  readonly count: number;
}

/**
 * Fill every empty cloud slot with a random cloud (Rise and Shine, Windmill).
 *
 * `baseCap` is passed in because the limit is a *game rule* owned by the cards
 * layer; the engine only knows the per-combatant bonus, and adds the two.
 */
export interface FillCloudSlots {
  readonly type: 'FillCloudSlots';
  readonly target: EntityId;
  readonly baseCap: number;
}

/**
 * Gain `multiplier x metric(self)` of a resource, measured at reduce time — the
 * `gain`/`poison` counterpart to DealDamageScaled ("gain 1 shield for each
 * minion in your discard pile", "poison for each card played this turn").
 */
export interface GainScaled {
  readonly type: 'GainScaled';
  readonly self: EntityId;
  readonly target: EntityId;
  readonly resource: 'block' | 'shield' | 'energy' | 'power' | 'bravery' | 'poison' | 'craft';
  readonly per: ScaleMetric;
  readonly multiplier: number;
}

/** Arm (or clear) "the next Venom keeps your Poison" — Sacrifice, Sticky Poison. */
export interface SetVenomRetains {
  readonly type: 'SetVenomRetains';
  readonly target: EntityId;
  readonly value: boolean;
}

/**
 * Card movement between a combatant's own piles. All four take the card from
 * the discard pile, because a card's own effects resolve *after* playing has
 * already moved it there — so "put this card back into your hand" is a move out
 * of the discard, not out of nowhere.
 */
export interface ReturnCardToHand {
  readonly type: 'ReturnCardToHand';
  readonly owner: EntityId;
  readonly cardId: CardId;
}

/** Put one copy of `cardId` back into the draw pile at a random depth. */
export interface ShuffleCardIntoDrawPile {
  readonly type: 'ShuffleCardIntoDrawPile';
  readonly owner: EntityId;
  readonly cardId: CardId;
}

/** Shuffle the draw pile in place (Crab Walk). */
export interface ShuffleDrawPile {
  readonly type: 'ShuffleDrawPile';
  readonly owner: EntityId;
}

/** Discard `count` cards off the top of the draw pile (Crab Walk). */
export interface DiscardFromDrawPile {
  readonly type: 'DiscardFromDrawPile';
  readonly owner: EntityId;
  readonly count: number;
}

/**
 * Move `count` cards from the discard pile back into the draw pile (Dry Out).
 * With `uids`, exactly those copies (a player's pick); without, the most
 * recently discarded.
 */
export interface MoveDiscardToDrawPile {
  readonly type: 'MoveDiscardToDrawPile';
  readonly owner: EntityId;
  readonly count: number;
  /** The chosen discard-pile copies. Overrides the most-recent default. */
  readonly uids?: readonly number[];
}

/**
 * Grant a per-copy card keyword to `count` cards in hand — Molt (Dungeon-ness,
 * Skitter), Add (Retirement) or Fading (Search, Rough Draft). The mark lands on
 * the *copies*, so it travels with them and is spent when they leave. Printed
 * keywords are stamped onto copies too, so this correctly skips a card that
 * already carries the keyword either way.
 */
export interface AddKeywordToHand {
  readonly type: 'AddKeywordToHand';
  readonly owner: EntityId;
  readonly keyword: 'molt' | 'add' | 'fading';
  readonly count: number;
}

/** Grant Molt to the top card of the draw pile (Decorator). */
export interface AddMoltToDrawTop {
  readonly type: 'AddMoltToDrawTop';
  readonly owner: EntityId;
}

/** Raise the Writer's stored Craft. */
export interface GainCraft {
  readonly type: 'GainCraft';
  readonly target: EntityId;
  readonly amount: number;
}

/**
 * Burn — the Writer's mechanic in its current form: spend Craft. Omitting
 * `amount` burns everything (Dumpster Diver's "Burn All"). Records what was
 * spent in `craftBurned` so the same card can deal damage equal to it, and
 * raises `CraftBurned`, which "when you Burn, …" persistents (Ink, Wordsmith)
 * key off.
 */
export interface BurnCraft {
  readonly type: 'BurnCraft';
  readonly target: EntityId;
  readonly amount?: number;
}

/** Set Craft to an exact value. */
export interface SetCraft {
  readonly type: 'SetCraft';
  readonly target: EntityId;
  readonly amount: number;
}

/**
 * Discard every Fading card left in `owner`'s hand — run at the end of their
 * turn. A real discard (it counts, and sets off Molt), like the Fog penalty.
 */
export interface DiscardFading {
  readonly type: 'DiscardFading';
  readonly owner: EntityId;
}

/**
 * Open or close the Old Lady's Blank window. While open, Add cards may be
 * played for free; the count of Adds played into it resets whenever it opens.
 */
export interface SetAddWindow {
  readonly type: 'SetAddWindow';
  readonly target: EntityId;
  readonly value: boolean;
}

/** Count one Add card played into the open window (Prunes scales off it). */
export interface NoteCardAdded {
  readonly type: 'NoteCardAdded';
  readonly owner: EntityId;
}

/** Promise a resource for the start of the target's next turn (Trophy, Destroy). */
export interface GrantNextTurn {
  readonly type: 'GrantNextTurn';
  readonly target: EntityId;
  readonly resource: 'energy' | 'power' | 'bravery' | 'craft' | 'shield';
  readonly amount: number;
}

/** Pay out (and clear) whatever was promised for this turn. */
export interface ApplyNextTurn {
  readonly type: 'ApplyNextTurn';
  readonly target: EntityId;
}

/**
 * Mark cards in `owner`'s hand with one of the Knight's four Markings. `scope`
 * picks which cards: the leftmost `count` (`'hand'`), `count` chosen at random
 * through the in-state RNG (`'random'`), or every card in hand (`'all'`).
 * Marking a card that already carries that marking *raises* its value.
 */
export interface MarkCards {
  readonly type: 'MarkCards';
  readonly owner: EntityId;
  readonly mark: MarkKind;
  readonly value: number;
  readonly count: number;
  readonly scope: 'hand' | 'random' | 'all';
}

/** Mark `count` cards with a randomly-chosen Marking (Chisel). */
export interface MarkCardsRandomKind {
  readonly type: 'MarkCardsRandomKind';
  readonly owner: EntityId;
  readonly value: number;
  readonly count: number;
}

/** Strip every Marking from every card in hand (Plate). */
export interface ClearMarks {
  readonly type: 'ClearMarks';
  readonly owner: EntityId;
}

/**
 * Pause the battle on a card choice ("choose 2 cards to discard"). Raised by
 * the cards layer mid-resolution for a human player; the suspended remainder
 * rides along in `pending.queued` and resumes when the choice resolves
 * (`resolvePendingChoice` in the cards layer, which also clears it).
 */
export interface SetPendingChoice {
  readonly type: 'SetPendingChoice';
  readonly pending: PendingChoice;
}

/** Lift the pause once its choice has been made. */
export interface ClearPendingChoice {
  readonly type: 'ClearPendingChoice';
}

/** Set a combatant's Bravery to an exact value (Brain Storm's "set to zero"). */
export interface SetBravery {
  readonly type: 'SetBravery';
  readonly target: EntityId;
  readonly amount: number;
}

/** Double a stored X-value in place — Bravery (Gamble it All) or Poison (Explosion). */
export interface DoubleResource {
  readonly type: 'DoubleResource';
  readonly target: EntityId;
  readonly resource: 'bravery' | 'poison' | 'craft';
}

/**
 * Convert all of the target's defense into Bravery (Cheater: "Gain Bravery
 * equal to your Defense, set your Defense to zero") — or, with `keep: false`
 * and no gain, simply strip it (Gamble it All's "lose all defense").
 */
export interface DefenseToBravery {
  readonly type: 'DefenseToBravery';
  readonly target: EntityId;
  /** When false, the defense is lost without becoming Bravery. */
  readonly gain: boolean;
}

/** Deal `amount` damage to every living opponent of `self` (Junk, the Eye relic). */
export interface DealDamageToAll {
  readonly type: 'DealDamageToAll';
  readonly self: EntityId;
  readonly amount: number;
}

/** Discard every minion a combatant has in play (Explosion). */
export interface DiscardAllMinions {
  readonly type: 'DiscardAllMinions';
  readonly owner: EntityId;
}

/**
 * Bookkeeping actions that change one counter / raise one event, so that things
 * the *cards layer* orchestrates (playing a card, replaying a minion) still
 * reach the reducer as actions and show up in the event stream for triggers.
 */
export interface NoteCardPlayed {
  readonly type: 'NoteCardPlayed';
  readonly owner: EntityId;
}

export interface NoteMinionReplayed {
  readonly type: 'NoteMinionReplayed';
  readonly owner: EntityId;
}

/**
 * Announce that a card carrying `mark` was played, so "when you play a card
 * Marked with Sharp, …" persistents can fire. Raised once per Marking on the
 * copy, alongside the Marking's own effect (see `src/cards/match/marks.ts`).
 */
export interface NoteMarkedCardPlayed {
  readonly type: 'NoteMarkedCardPlayed';
  readonly owner: EntityId;
  readonly mark: MarkKind;
}

/** Arm (or clear) "your clouds play twice next turn" — Solar Power. */
export interface SetCloudsPlayTwice {
  readonly type: 'SetCloudsPlayTwice';
  readonly target: EntityId;
  readonly value: boolean;
}

/** Remove every cloud a combatant holds (Dissolve). */
export interface RemoveAllClouds {
  readonly type: 'RemoveAllClouds';
  readonly target: EntityId;
}

/** Widen a combatant's cloud cap by `amount` slots, for the rest of the battle. */
export interface IncreaseMaxClouds {
  readonly type: 'IncreaseMaxClouds';
  readonly target: EntityId;
  readonly amount: number;
}

/** Raise the run-out-of-cards refill draw by `amount` (Brain Jar: 4 not 3). */
export interface IncreaseRefillDraw {
  readonly type: 'IncreaseRefillDraw';
  readonly target: EntityId;
  readonly amount: number;
}

/** Remove the single cloud at `index` (how the cloud-cap replacement picks one). */
export interface RemoveCloudAt {
  readonly type: 'RemoveCloudAt';
  readonly target: EntityId;
  readonly index: number;
}

/**
 * Venom: deal damage equal to the caster's Poison to `target`, then set the
 * caster's Poison to 0. The "equal to your Poison" scaling is resolved here, at
 * reduce time, so it stays deterministic and needs no play-time state peek.
 */
export interface Venom {
  readonly type: 'Venom';
  readonly self: EntityId;
  readonly target: EntityId;
  /**
   * Consuming: "lose only half of your Poison when you use Venom or Drink".
   * Set by the cards layer from the caster's persistents as the action is
   * applied, so the reducer stays ignorant of what's in the play area.
   */
  readonly keepHalf?: boolean;
}

/** Drink: gain Block equal to the caster's Poison, then set Poison to 0. */
export interface Drink {
  readonly type: 'Drink';
  readonly self: EntityId;
  /** As Venom's — Consuming halves what the Drink spends. */
  readonly keepHalf?: boolean;
}

/** Summon a minion that is a copy of `cardId`, owned by `owner`. */
export interface SummonMinion {
  readonly type: 'SummonMinion';
  readonly owner: EntityId;
  readonly cardId: CardId;
}

/**
 * Discard up to `count` of the owner's minions. With `indices`, exactly those
 * (a player's pick); without, most-recently-summoned first.
 */
export interface DiscardMinion {
  readonly type: 'DiscardMinion';
  readonly owner: EntityId;
  readonly count: number;
  /** The chosen minions, by board position. Overrides the newest-first default. */
  readonly indices?: readonly number[];
}

/** The discriminated union of every atomic action the engine understands. */
export type Action =
  | StartTurn
  | EndTurn
  | SetPhase
  | ClearBlock
  | DiscardCards
  | MoveHandCardToDiscard
  | AddPersistent
  | DrawCards
  | DealDamage
  | LoseHp
  | DealDamageToRandomEnemy
  | DealDamageScaled
  | GainBlock
  | GainShield
  | Heal
  | GainEnergy
  | SetEnergy
  | GainPoison
  | GainPower
  | GainPowerAll
  | ConvertPowerToHeal
  | GainBravery
  | CreateClouds
  | RemoveClouds
  | RemoveCloudAt
  | Venom
  | Drink
  | SummonMinion
  | DiscardMinion
  | ClearTurnCounters
  | DiscardHand
  | RemoveAllClouds
  | IncreaseMaxClouds
  | IncreaseRefillDraw
  | CreateRandomClouds
  | RemoveRandomClouds
  | FillCloudSlots
  | SetCloudsPlayTwice
  | GainScaled
  | SetVenomRetains
  | DiscardAllMinions
  | NoteCardPlayed
  | NoteMinionReplayed
  | NoteMarkedCardPlayed
  | ReturnCardToHand
  | ShuffleCardIntoDrawPile
  | ShuffleDrawPile
  | DiscardFromDrawPile
  | MoveDiscardToDrawPile
  | AddKeywordToHand
  | AddMoltToDrawTop
  | GainCraft
  | BurnCraft
  | SetCraft
  | DiscardFading
  | SetAddWindow
  | NoteCardAdded
  | GrantNextTurn
  | ApplyNextTurn
  | MarkCards
  | MarkCardsRandomKind
  | ClearMarks
  | SetBravery
  | DoubleResource
  | DefenseToBravery
  | DealDamageToAll
  | SetPendingChoice
  | ClearPendingChoice;

export type ActionType = Action['type'];
