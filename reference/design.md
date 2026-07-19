<!--
Editor's notes (added while reconciling this design with the project docs — the rulebook below is unchanged).

This document is the source of truth for *what the game is*. The docs in `docs/` describe *how it's built*;
the implementation is still an early skeleton and does not yet match this design (see `docs/roadmap.md`).

Decisions locked in:
- Title is "Weather & Wanderers"; "WizardCards" remains the repo/codebase name.
- Scope is self-contained battles — pick a character, draft a deck, pick 1 relic, fight one opponent,
  ~10 turns, no meta-progression (no map / rewards / run structure).
- Deck model: each character has a ~40-card pool (the card tables below); you play a 20-card deck drawn from it.

Rules clarifications (decided; also in `docs/vision.md`):
- Energy: start each turn with 1 energy; cards cost 1 by default (baseline = one card/turn; energy cards
  let you play more).
- Enemies play like players — opponents run the same card system, not scripted intents.
- No turn limit; "~10 turns" is just a typical match length. Running out of cards reshuffles the discard
  (no deckout loss). You win by taking the opponent to 0 HP.
- No cloud-slot cap currently, so "Increase Max Clouds" cards are no-ops until a cap exists.
- The 3 offered relics are drawn from both the general pool and the character's pool.

- Opening hand: draw 5, discard 2, so you begin turn 1 holding 3 cards. Hand max is 10.

Update: Block (temporary) and Shield (persistent) are now two distinct resources on Combatant, and the
single-battle game loop (character/relic select → battle vs. a card-playing opponent) is playable — see
docs/battle.md and docs/roadmap.md (Phase 2).
-->

# Weather \& Wanderers — Card Game Rulebook

A deck-building combat game where each character builds around a distinct mechanic. Choose a character, draft a deck, pick a relic, and battle your opponents.

\---

## Game Setup \& Core Rules

* Each deck contains **40 cards** total.
* At the start of the game, when you choose a character you are given a deck of **20 random cards**.
* You are also offered a choice of **3 Relics**, and you keep **1** for the round.
* When you first begin, **draw 5 cards**, then **discard 2 cards**.
* At the start of your turn, **draw 1 card**.
* You start the game with **20 Health**.

\---

= AI first, MP next

= Set deck per character, start with no progression, think like a printable card game.

= Each character has a special ability. Some have special indicator tokens.

= Simple mana system (start with 1), some cards let you play more cards.

= Start with 20 health. One or more opponents, but start with one opponent.

= No special zones or spacing.

= MTG draw rules, Draw 5, discard 2, (starting with 3) 10 max, always draw 1 on your turn, discard down to 10.

= Discard pile, draw pile

= Some cards last 1 turn, some last all the turns

= \~10 turns

= Block is temp, Shields persist.


## General Terms

|Term|Meaning|
|-|-|
|**Attack**|Deal X Damage|
|**Shield**|Protects you from X damage. Stays out until all shields on the card are destroyed.|
|**Draw**|Draw X Cards|
|**Discard**|Put X cards from your hand into your discard pile|
|**Energy**|Play X more cards|
|**Heal**|Gain X Hearts back (until Max HP)|

### All Effects

* Take X Damage
* Gain X Power
* Gain X Bravery
* Create X Lightning Clouds
* Create X Storm Clouds
* Create X Fog Clouds
* Create X Snow Clouds

\---

# The Cloud

The Cloud creates Smaller Clouds that trigger small effects at the start of The Cloud's turn.

## Main Mechanics

* **Lightning Clouds** — At the start of your turn, for each Lightning Cloud gain 1 additional energy.
* **Snow Clouds** — At the start of your turn, for each Snow Cloud heal 1 Heart.
* **Fog Clouds** — At the start of your turn, for each Fog Cloud draw 1 additional card. At the end of your turn, discard 1 card.
* **Storm Clouds** — At the start of your turn, deal 1 Damage to a random opponent.
* **Removing Clouds** — Whenever a card with this is played, X Clouds (your choice) are Removed and put into your discard pile.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Sun Ray**|Deal 3 Damage, Remove 1 Cloud|
|2|**Crisscross**|Deal 4 Damage, Remove 1 Cloud|
|3|**Zap**|Deal 2 Damage, Gain 1 Energy|
|4|**Shine**|Deal 6 Damage, Remove 3 Clouds|
|5|**Hurricane**|Deal 3 Damage, Create 2 Storm Clouds|
|6|**Whirlwind**|Deal 4 Damage, Trigger all Storm Clouds|
|7|**Electrocute**|Deal Damage equal to your energy|
|8|**Spin**|Deal 3 Damage for each unique cloud|
|9|**Dissolve**|Remove all Clouds, Deal 2 Damage for each cloud removed|

## Skills

|#|Name|Effect|
|-|-|-|
|1|**Cleanse**|Heal 3, Remove 2 Clouds|
|2|**Thunder**|Create 1 Lightning Cloud|
|3|**Sprinkle**|Gain 2 Shields, Create 1 Fog Cloud|
|4|**Breeze**|Gain 3 Shields, Create 1 Snow Cloud|
|5|**Hailstorm**|Create 1 Snow Cloud, Draw 1 Card|
|6|**Haze**|Draw 3 Cards|
|7|**Rise and Shine**|Fill all empty Cloud Slots with Random Clouds|
|8|**Draw Later**|Draw 1, Create 2 Fog Clouds|
|9|**Rain**|Gain 4 Shields|
|10|**Empty Out**|Heal 1, Remove 3 Clouds|
|11|**Spark**|Gain 3 Energy, Remove 3 Clouds|
|12|**Cyclone**|Create 1 Storm Cloud|
|13|**Outburst**|Create 1 Storm Cloud, Increase Max Clouds by 1|
|14|**Lunar Weather**|Remove 1 Cloud, Create a Random Cloud|
|15|**Typhoon**|Create 2 Storm Clouds, Gain 1 Energy|
|16|**Spatial Reasoning**|Remove 3 Clouds, Increase Max Clouds by 1|
|17|**Trickle**|Create 1 Storm Cloud, Create 1 Fog Cloud|
|18|**Solar Power**|Next turn, your clouds play twice|
|19|**Bolt**|Create 1 Lightning Cloud, Gain 1 Energy|
|20|**Blizzard**|Create 1 Snow Cloud|
|21|**Draw Now**|Draw 2, Create 1 Fog Cloud|
|22|**Mist**|Create 1 Fog Cloud|
|23|**Final Shock**|Create 3 Lightning Clouds|
|24|**Clear**|Remove 1 Cloud, Create 2 Fog Clouds|

## Persistents

|#|Name|Effect|
|-|-|-|
|1|**Winter**|Snow Clouds heal 2 HP instead of 1|
|2|**Spring**|Whenever you create a cloud, deal 1 Damage to all opponents|
|3|**Autumn**|Fog Clouds no longer force you to discard|
|4|**Summer**|If you start with over 3 energy on your turn, deal 4 Damage to all opponents|
|5|**Wild Wind**|Replace a Random Cloud with another Random Cloud at the end of your turn|
|6|**Windmill**|At the end of your turn, fill all empty Cloud Slots with Random Clouds|
|7|**Static**|Whenever a Lightning Cloud is removed, deal 2 Damage to all opponents|

\---

# The Crab

The Crab takes advantage of discarding cards by having cards that are played when they discard.

## Main Mechanics

* **Claw** — Whenever this card is discarded, it plays for free.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Little Splash**|Deal 8 Damage|
|2|**Pinch**|*Claw* — Deal 4 Damage|
|3|**Quicksand**|Discard 1, Deal 2 Damage|
|4|**Blend In**|Deal 4 Damage, Gain 2 Shields|
|5|**Smack**|Deal 2 Damage — The next card you discard with Claw is played twice|
|6|**Locator**|*Claw* — Deal 1 Damage for each card discarded this turn|
|7|**Swipe**|*Claw* — Draw 2 Cards, Deal 6 Damage|
|8|**Crust Kick**|*Claw* — Deal 2 Damage, Put this card back into your hand|
|9|**Tentacles**|Gain 1 Energy, Deal 4 Damage — Shuffle this into your draw pile|

## Skills

|#|Name|Effect|
|-|-|-|
|10|**Hermit**|*Claw* — Heal 2, Discard 1|
|11|**Steamroll**|Gain 2 Shields, Draw 1, Discard 1|
|12|**Snip**|Draw 2|
|13|**Waterspout**|Heal 1, Draw 1, Discard 1|
|14|**Glacial Melt**|*Claw* — Draw 1, Gain 1 Energy|
|15|**Hook**|*Claw* — Gain 2 Energy|
|16|**Molt**|Draw 3|
|17|**Refresh**|Gain 1 Energy, Discard your hand, Draw 3 Cards|
|18|**Double Draw**|Draw 2, Discard 2|
|19|**Sandbed**|Heal 1, Gain 4 Shields|
|20|**An-Enemy**|Gain 1 Shield, Gain 1 Energy|
|21|**Boil**|Gain 1 Energy, Discard 3|
|22|**Pickle Pal**|*Claw* — Gain 5 Shields|
|23|**One Finger Touch**|Draw 3, Discard 1|
|24|**Crab Walk**|Shuffle your deck. Discard the top 3 Cards of your Draw Pile|
|25|**Marine Life**|When you draw a card this turn, draw it from your discard pile until it is emptied|
|26|**Filter Feed**|*Claw* — Choose a card in your hand. Put a copy of that card into your draw pile|
|27|**Dry Out**|Gain 4 Shields, Put a card from your discard pile into your draw pile|
|28|**Scuttle**|Discard 2. Whenever you play one of the cards discarded this way, deal 2 Damage to a random opponent|
|29|**Dungeon-ness**|Gain 3 Shields. Add Claw to a card in your hand|
|30|**Shell**|Gain 1 Energy. Your next card is played twice|
|31|**Low Tide**|*Claw* — Heal 1, Draw 1|
|32|**Skitter**|*Claw* — Add Claw to 2 Cards in your Hand|
|33|**Flying Fish**|The next time you discard, draw cards equal to the cards you discarded with the card used to discard|

## Persistents

|#|Name|Effect|
|-|-|-|
|34|**Barnacle**|The first card you discard on your turn plays twice the next time you play it|
|35|**Exoskeleton**|If you have 5+ block at the end of your turn, discard your hand and draw 4 cards|
|36|**Decapod**|If you discard 10 Cards on your turn, deal 10 Damage to all opponents|
|37|**Crab Trap**|At the start of your turn, draw 1 additional card|
|38|**Eyestalks**|If you discard your entire hand on your turn, gain 2 Energy|
|39|**Decorator**|When you shuffle your deck, the top card of your draw pile gains Claw|
|40|**Prawn**|When you discard a card with Claw, deal 3 Damage to an opponent of your choice|

\---

# The Wizard

The Wizard uses Poison to store an X Value that can be used to do spells.

## Main Mechanics

* **Poison** — Increase your Poison value by an amount.
* **Venom** — Deal Damage equal to your Poison. Once a card with Venom has been played, set Poison to 0.
* **Drink** — Gain Block until your next turn equal to your Poison. Once a card with Drink has been played, set Poison to 0.
* **Minion** — Whenever this card is first played, play the card. At the start of your turn, replay this card. Whenever this card is attacked, it takes all damage and is discarded.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Zap**|Deal 2 Damage, Draw 1 Card|
|2|**Stun**|Deal 3 Damage|
|3|**Guard Dog**|*Minion* — Deal 1 Damage, Gain 2 Shields for this turn. Replay this card at the start of your turn|
|4|**Barrel Roll**|Deal 5 Damage, Poison 2|
|5|**Mind Read**|Drink, Deal 3 Damage|
|6|**Slice**|Deal 4 Damage, Gain 1 Energy|
|7|**Crystal Ball**|Deal 1 Damage for each Minion currently in Play|
|8|**Throw**|Deal 8 Damage, Discard 1 Minion|
|9|**Hurl**|Discard 2 Minions, Deal Damage equal to your block|
|10|**Hostile**|Venom, Drink|
|11|**Seek**|Venom, Gain 1 Energy|
|12|**Pour**|Venom, Gain 3 Shields|
|13|**Sticky Poison**|*Venom* — Retain your Poison Value|
|14|**Poison Spill**|*Minion* — Venom|

## Skills

|#|Name|Effect|
|-|-|-|
|1|**Electric**|Draw 2 Cards, Gain 1 Energy|
|2|**Alchemy**|*Minion* — Poison 1. Replay this card at the start of your turn|
|3|**Delivery**|*Minion* — Draw 1 Card at the start of your turn|
|4|**Battery**|*Minion* — Gain 1 Energy|
|5|**Bake**|Heal 4, Poison 3|
|6|**Fuel**|Poison 3, Drink|
|7|**Nobody Home**|Gain 4 Shields, Gain 1 Energy|
|8|**Safety Spell**|Draw 1 Card, Heal 2|
|9|**Squid Mode**|Drink Twice, Gain 1 Energy|
|10|**Curse**|Poison 5|
|11|**Shock**|Gain 2 Energy|
|12|**Cauldron**|Gain 5 Shields|
|13|**Vial**|Poison for each Card Played this Turn|
|14|**Explosion**|Double your Poison Value, Discard Your Hand \& Discard all Minions|
|15|**Clone**|Create a Copy of one of your minions. Add it into your Discard pile|
|16|**Acidic**|Poison 3, Gain 2 Energy|
|17|**Pile Up**|Gain 1 Shield for each Minion in your Discard Pile|
|18|**Sacrifice**|Poison 6, Discard a Minion — The next time you Venom, your poison is retained|
|19|**Unfriendly**|Draw 4 Cards, Discard 1 Minion|
|20|**Blocked**|Gain 1 Energy — Your Minions are Protected for the next 2 turns|
|21|**Mixture**|Poison 2, Gain 4 Shields|

## Persistents

|#|Name|Effect|
|-|-|-|
|1|**Protect the Drinks**|Minions are replayed 1 additional time|
|2|**Rot Away**|Whenever you deal unblocked damage, Poison 1|
|3|**Consuming**|When a minion is discarded, Heal 1|
|4|**Stop Drop \& Roll**|When a minion is discarded, your other minions are protected for the next turn|
|5|**Juggle**|Gain 1 Block for this turn when a minion is replayed|

\---

# The Old Lady

The Old Lady has the Lowest Attacks of any character, but makes up for it by increasing damage dealt.

## Main Mechanics

* **Blank** — Has no effects. Whenever this card is played, all cards with "Add" are free to play until a non-Add/Blank card is played.
* **Add** — This card cannot be played regularly.
* **Power** — The first time you attack an enemy on your turn, deal X more damage.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Throwing Stars**|Deal 1 Damage, Gain 1 Energy|
|2|**Smoke Bomb**|Gain 4 Shields, Deal 3 Damage, Gain 2 Power, Lose 1 HP|
|3|**Evil Glare**|Deal 3 Damage, Lose 1 HP|
|4|**Swords at the Ready**|*Add* — Deal 2 Damage|
|5|**Simple Slash**|Deal 4 Damage, Lose 1 Power|
|6|**Prunes**|*Add* — Deal 1 Damage for each Card Added to this blank card this turn|
|7|**Escape Plan**|Deal 3 Damage, Gain Shields equal to damage dealt|

## Cards

|#|Name|Effect|
|-|-|-|
|8|**Paper**|Blank|
|9|**Intimidate**|Gain 2 Power, Gain 3 Shields|
|10|**Bucket List**|*Add* — Draw 1, Heal 2|
|11|**Collection**|Draw 2, Heal 1|
|12|**Butcher**|Gain 3 Energy, Lose 1 HP|
|13|**Fear**|Gain 1 Power, Gain 2 Shields|
|14|**Blank Slate**|Blank|
|15|**Gain Health**|*Add* — Heal 1|
|16|**Air**|Blank|
|17|**Rest**|Heal 2, Gain 1 Energy|
|18|**Preparation**|*Add* — Gain 1 Energy|
|19|**Mystery**|Blank|
|20|**Get Ready**|*Add* — Draw 1|
|21|**Crossing Guard**|*Add* — Lose 2 HP, Gain 6 Shields|
|22|**Scare**|*Add* — Lose 1 HP, Gain 1 Energy|
|23|**Violent**|*Add* — Gain 3 Power|
|24|**Destroy**|*Add* — Lose 3 HP, Gain 2 Power next turn|
|25|**Papier Machette**|Clone a Blank card in your hand and add it to your draw pile|
|26|**Challenge**|You gain 2 Power, all opponents gain 1 Power|
|27|**Dash**|Gain 1 Power this turn for each Blank card in your hand|
|28|**Fruit Juice**|*Add* — Heal 5|
|29|**Mend**|Heal Equal to HP Lost on your turn this turn|
|30|**Mind Games**|Everyone gains 6 Shields, Gain 5 Power for one turn next turn|
|31|**Senior Citizen**|Add a Random Blank card into your Discard Pile|
|32|**Retirement Plan**|Lose 2 Power, Put Add on a card in your hand|

## Persistents

|#|Name|Effect|
|-|-|-|
|33|**Payback**|If you play a card that deals over 2 damage, Heal 3|
|34|**Risks I'll Have to Take**|When you Lose HP on your turn, gain 1 Power|
|35|**Crossword**|When you play a Blank card, gain 1 Energy|
|36|**Blackmail**|Lose all Power, Heal equal to Power Lost|
|37|**Stab Wound**|The First card you Add each turn is played twice|
|38|**Matriarch**|At the start of your turn, Lose 1 HP and Gain 1 Power|
|39|**Time Heals all Wounds**|When you Create a Blank Card, deal 2 Damage to a Random Enemy|
|40|**Revenge**|If you take damage on your turn, deal 3 damage to all opponents|

\---

# The Writer

Works with Unplayable cards, "burning" them for effects, and building Bravery to power a burst of block or damage.

## Main Mechanics

* **Unplayable** — Cannot be Played Regularly. Still contains effects.
* **Burn** — Discard X Unplayable Cards (Trigger all effects on them).
* **Find** — Draw X Cards. If you draw an Unplayable Card, do X. Keep all cards drawn.
* **Bravery** — The first block card you play gives you X additional block.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Pen Stab**|Deal 3 Damage — Gain 1 Energy|
|2|**Reframe**|Draw 2 Cards, Deal 3 Damage|
|3|**Dispose**|*Unplayable* — Deal 4 Damage|
|4|**Dumpster Diver**|Burn 1 — Deal 2 Damage|
|5|**Type**|Find — Draw 2 — Deal 2 Damage|
|6|**Scrap**|*Unplayable* — Deal 1 Damage to all opponents|
|7|**Rescue**|Gain 1 Energy — Find — Draw 1 — Deal 3 Damage|
|8|**Brain Storm**|Deal Damage equal to your bravery. Set your bravery to Zero|

## Cards

|#|Name|Effect|
|-|-|-|
|9|**Search**|Find — Draw 3 — Gain 3 Energy|
|10|**Uncreative**|At the start of your turn, Burn 1 and Draw 1 Additional Card|
|11|**Quill**|Gain 4 Shields, Gain 1 Bravery|
|12|**Look**|Find — Draw 2 — Heal 3|
|13|**Notes**|*Unplayable* — Gain 2 Shields|
|14|**Draft**|*Unplayable* — Draw 1, Gain 1 Bravery|
|15|**Treasure**|Burn 2 — Heal 3|
|16|**Scribble**|*Unplayable* — Gain 1 Energy|
|17|**Refresh**|Burn 3 — Draw 3|
|18|**Evade**|Burn 2 — Gain 3 Bravery|
|19|**Trash Can**|Add Unplayable to 2 Cards in your Hand, Gain 1 Energy|
|20|**Pull From the Hat**|Play a Random Card in your Draw Pile|
|21|**Shredder**|If there is an Unplayable Card in the top 2 cards of your draw pile, Burn it, and Double its effect|
|22|**Writing Prompt**|Gain 1 Random Effect, Gain 2 Shields|
|23|**Inspiration**|Find — Draw 2 — Burn all Unplayable Cards in your Hand|
|24|**Stack**|Find — Draw 1 — Draw 4|
|25|**Reset**|Discard all cards in your hand — Find — Draw 3 Cards — Gain 2 Energy|
|26|**Playwright**|Burn — Gain 3 Energy|
|27|**Gamble it All**|Find — Draw 1 Card — Gain 5 Shields|
|28|**Cheater**|Look at the top 3 Cards of your Draw Pile|
|29|**Podcast**|Gain 2 Bravery, Gain 1 Shield|
|30|**Well Rested**|Next turn, gain 1 Bravery and play 1 additional card|
|31|**Memoir**|Find — Draw 1 Card — Gain 4 Bravery|

## Persistents

|#|Name|Effect|
|-|-|-|
|32|**Ink**|When you Burn an Unplayable Card, deal 2 Damage to all opponents|
|33|**Shake Spear**|When you draw an additional card on your turn, deal 2 damage to a random enemy|
|34|**Pass**|Cards with Burn cost 1 Less Burn to Play|
|35|**Whiteboard**|Gain Block for each New Unplayable Card in your Hand at the end of your turn|
|36|**Strategy**|When you draw an Unplayable card, draw 1 additional card|
|37|**Ask AI**|Cards with Find replay their effect for each unplayable card drawn when finding (No Replay for 1 Unplayable Drawn)|
|38|**Editor**|Draw 1 Additional Card when Finding|
|39|**Wordsmith**|Burn a random unplayable card in your hand — Gain 1 Energy|
|40|**Scribe**|Gain 1 Bravery for each additional card you draw on your turn. Reset all bravery gained this way at the end of your turn|

\---

# Relics

## General Relics

|#|Name|Effect|
|-|-|-|
|1|**Ripped Heart**|Start Combat with an additional 3 Max HP|
|2|**Sword**|Begin combat by dealing 4 Damage to a random opponent|
|3|**Brain in a Jar**|When you run out of cards, draw 4 cards instead of 3|
|4|**Old Shield**|Start combat with 5 Shields|
|5|**Calculator**|Start combat with 2 Energy|
|6|**Key**|At the start of combat, you can keep all 5 Cards Drawn|
|7|**Chest**|Start Combat with 25 Cards in your Draw Pile instead of 20|
|8|**Rusty Knife**|At the start of combat, deal 3 Damage to all Opponents|
|9|**Decorated Shield**|The first time you gain block in combat, double that amount|
|10|**Urn**|At the end of your turn, gain 1 Shield|

## Crab Relics

|#|Name|Effect|
|-|-|-|
|1|**Fossil**|At the start of combat, after drawing 5 cards, choose a card to add Claw to|
|2|**Toy Boat**|Attacks with Claw deal 1 Additional damage|
|3|**Fish Food**|Whenever you play a card with discard, Gain 1 Shield|
|4|**Whale**|When you shuffle, Draw 2 Cards|
|5|**Seashell**|At the start of combat, Draw 6 Cards and discard 2|

## Cloud Relics

|#|Name|Effect|
|-|-|-|
|1|**Lightning Rod**|At the start of combat, Create 1 Lightning Cloud|
|2|**Smokepipe**|At the start of combat, Create 1 Fog Cloud|
|3|**Weather Wand**|At the start of combat, Create 1 Storm Cloud|
|4|**Snow Globe**|At the start of combat, Create 1 Snow Cloud|
|5|**Compass**|At the start of combat, Begin with 1 Persistent Card|

## Wizard Relics

|#|Name|Effect|
|-|-|-|
|1|**Vial**|Start Combat with 3 Poison|
|2|**Leaky Potion**|Poison decreases by 1 Each turn. Venom and Drink have 50% More Effect|
|3|**Help Wanted Ad**|Start combat with an additional random Minion|
|4|**Cloning Machine**|Create a copy of a starter card and put it in your draw pile|
|5|**Thorn Shield**|When you gain Block, Deal 2 Damage to a random opponent|

## Old Lady Relics

|#|Name|Effect|
|-|-|-|
|1|**Cookie Jar**|The first time in combat you lose HP on your turn, Heal 3|
|2|**Hearing Aid**|Start Combat with 2 Power|
|3|**Walker**|Begin with 1 additional Blank card in your hand|
|4|**Pearl Necklace**|If you play 2 or more Blank cards on your turn, deal 4 Damage to a Random Opponent|
|5|**Quilt**|At the start of your turn, Heal 1|

## Writer Relics

|#|Name|Effect|
|-|-|-|
|1|**Typewriter**|Draw an additional unplayable card at the start of your turn|
|2|**Notebook**|You begin combat with 2 of a random effect|
|3|**Script**|Take a look at the top 2 cards of your draw pile once you have selected your cards|
|4|**Highlighter**|The first card you draw that has Burn does not cost unplayable cards to play|
|5|**Gel Pen**|Start combat with 1 Bravery|



