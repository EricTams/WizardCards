<!--
Editor's notes (added while reconciling this design with the project docs — the rulebook below is the
content drop of 2026-08-15, transcribed from `Competitive Card Game.md`).

This document is the source of truth for *what the game is*. The docs in `docs/` describe *how it's built*;
the implementation does not yet match all of it (see `docs/roadmap.md`).

Decisions locked in:
- Title is "Weather & Wanderers"; "WizardCards" remains the repo/codebase name.
- Scope is self-contained battles — pick a character, draft a deck, pick 1 relic, fight one opponent,
  ~10 turns, no meta-progression (no map / rewards / run structure).
- Deck model: each character has a ~40-card pool (the card tables below); you play a 20-card deck drawn from it.

Rules clarifications (decided; also in `docs/vision.md`):
- Energy: start each turn with 1 energy; cards cost 1 by default (baseline = one card/turn; energy cards
  let you play more).
- Enemies play like players — opponents run the same card system, not scripted intents.
- No turn limit; "~10 turns" is just a typical match length. Running out of cards = your hand hitting
  zero: the moment it does, draw 3 new cards (Brain Jar: 4), reshuffling the discard into the
  draw pile as needed (no deckout loss). You win by taking the opponent to 0 HP.
- Cloud cap is 3: creating more clouds than that replaces existing ones (the player picks which to drop, one at a time; the AI drops its oldest). "Increase Max Clouds" cards raise this cap.
- The 3 offered relics are drawn from both the general pool and the character's pool.
- Opening hand: draw 5, discard 2, so you begin turn 1 holding 3 cards. Hand max is 10.
- Block (temporary) and Shield (persistent) are two distinct resources on Combatant.
- Turn 1 runs no upkeep: no energy reset and no Power decay, so a combat-start relic survives into it.

Naming: a few cards are named for their **art file** rather than the rulebook line, because the game
builds card faces from the card's name. Where they differ, the art wins:
- The Cloud's "Autumn" is **Fall** (`Cloud Cards-Fall.png`).
- The Old Lady's "Retirement Plan" is **Retirement** (`Old Lady Cards-Retirement.png`).

Delivered art: card faces for the Cloud, Wizard, Crab, Writer and Old Lady; hero animations for the
Cloud, Wizard and Crab; level backdrops + platforms for all five; Persistent icons for all five;
25 relic icons. The **Knight has no art yet** — it is authored but not offered at character select.
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

# The Knight

The Knight prepares the cards in your hand: **Markings** are stickers with a value that fire when the marked card is played.

## Main Mechanics

* **Marked** — Marked cards activate their Marked Effect when played, and then lose the special effect. Cards can have multiple Markings.
* **Sharp** — When played, deal X damage to a random enemy.
* **Sturdy** — When played, draw X cards.
* **Flaming** — When played, gain X energy.
* **Safe** — When played, heal X HP.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Catapult**|Deal 4 Damage — Draw 1 Card|
|2|**Joust-lopy**|Deal 2 Damage — Gain 1 Energy|
|3|**Armory**|Deal 3 Damage — Draw 2 Cards|
|4|**Invade**|Deal 2 Damage — Deal 2 additional Damage for each Unique Marking on this card|
|5|**Dynamite**|Deal 3 Damage — Mark two Cards in your hand with Sharp 2|
|6|**Spike Pit**|Deal 1 Damage — If this card is Marked with Sharp, the Sharp value on this card is Doubled|
|7|**Battle Wound**|Deal 3 Damage — If this card is Marked with Sturdy it is Played Twice|
|8|**Chivalry**|Deal 3 Damage — Mark a Card in your hand with Sturdy 1|
|9|**Matches**|Deal 3 Damage — Mark a Random Card in your hand with Flaming 1|
|10|**Royal Fireworks**|Deal 2 Damage — Gain 1 Energy — Mark Half of the cards in your Hand Randomly with Flaming 1 this Turn|
|11|**Take Shelter**|Deal 3 Damage — Mark a Card with Safe 2|
|12|**Drawbridge**|Deal 3 Damage — Mark two Cards with Safe 1|

## Skills

|#|Name|Effect|
|-|-|-|
|1|**Blades**|Gain 2 Energy — Mark a Card in your Hand With Sharp 1 — When you Play a Card this turn, increase the value of Sharp on that card by 1|
|2|**Protect**|Gain 3 Shields — Mark all Cards in your hand with Sharp 1|
|3|**Blinding**|Gain 1 Energy — Mark the next card you play this turn with Sharp 4|
|4|**Behead**|Mark two Cards in your Hand with Sharp 2|
|5|**Blockade**|Gain 1 Energy — For this turn, Mark all Cards with Sturdy 2|
|6|**Range**|Gain 4 Shields — Mark a Card with Sturdy 3|
|7|**Snap**|Mark a Card with Sturdy 2 and Flaming 1|
|8|**Carve**|Increase the Cards Drawn from Sturdy by 1 for all Cards in your hand that are Marked with Sturdy|
|9|**Torch**|Gain 1 Energy — Mark a Card in your Hand with Flaming 1|
|10|**Chain Mail**|Draw 1 Card — Mark a Card with Flaming 2|
|11|**Plate**|All Cards in your hand Lose their Markings — Add Flaming 3 to a Card in your Hand|
|12|**Cindering**|Draw 3 Cards — Mark a Random Card that was Drawn this way with Flaming 1|
|13|**Healing Potion**|Heal 2 — Mark a Card in your Hand with Safe 3 Next Turn|
|14|**Solid Gold**|Draw 4 Cards — All Cards Drawn this way are Marked with Safe 1|
|15|**Recover**|Gain 5 Shields — Mark this Card with Safe 1 — Increase the Amount of Safe being Marked on this card by 1 when it is Drawn|
|16|**Secure**|Mark All Cards in your hand with Safe 3 — Decrease the Amount of Safe on these cards by 1 for each turn they are in your hand|
|17|**Sharper**|The Next Card you play that is Marked with Sharp does Double Sharp damage|
|18|**Lumber**|Draw 2 Cards — Gain 1 Energy|
|19|**Chisel**|Add a Random Marking with the Value of 3 to a Card in your Hand|
|20|**Helmet**|Gain 6 Shields|

## Persistents

|#|Name|Effect|
|-|-|-|
|1|**Sculpt**|If a Card has 2 or More Unique Markings, Gain 1 Energy when that card is played|
|2|**Whittling**|Every 4th Card you play with a Marking does not lose its marking when it is played|
|3|**Engrave**|Gain 1 Shield when you play a card that is Marked with Sharp|
|4|**Etching**|Draw a Card when you play a Card that is Marked with Sturdy|
|5|**Reshape**|Cards that are Marked with Flaming have the value of Flaming on the card increased by 1|
|6|**Woodworking**|When you play a card that is Marked with Safe, do 2 Damage to a Random Opponent|
|7|**Cannonball**|The first time you draw an additional card on your turn, deal damage equal to the cards drawn to a random enemy|
|8|**Figurine**|At the Start of your Turn, Randomize the Marking types on all Cards in your Hand that are already Marked|

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
|2|**Stun**|Deal 3 Damage — Increase Damage Dealt by this card by 1|
|3|**Guard Dog**|*Minion* — Deal 1 Damage, Gain 2 Shields for this turn. Replay this card at the start of your turn|
|4|**Barrel Roll**|Deal 5 Damage, Poison 2|
|5|**Mind Read**|Drink, Deal 3 Damage|
|6|**Slice**|Deal 4 Damage, Gain 1 Energy|
|7|**Crystal Ball**|Deal 1 Damage for each Minion currently in Play|
|8|**Throw**|Deal 8 Damage, Discard 1 Minion|
|9|**Hurl**|Discard 2 Minions, Deal Damage equal to your defense|
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
|15|**Clone**|Create a Copy of one of your Minions. Add it into your Discard pile|
|16|**Acidic**|Poison 3, Gain 2 Energy|
|17|**Pile Up**|Gain 2 Shields for each Active Minion|
|18|**Sacrifice**|Poison 6, Discard a Minion — The next time you Venom, your poison is retained|
|19|**Unfriendly**|Draw 4 Cards, Discard 1 Minion|
|20|**Blocked**|Gain 1 Energy — Your Minions are Protected for the next 2 turns|
|21|**Mixture**|Poison 2, Gain 4 Shields|

## Persistents

|#|Name|Effect|
|-|-|-|
|1|**Protect the Drinks**|Minions are replayed 1 additional time|
|2|**Rot Away**|Whenever you deal unblocked damage, Poison 1|
|3|**Consuming**|Lose Only Half of your Poison when you use Venom or Drink|
|4|**Stop Drop \& Roll**|When a minion is discarded, your other minions are protected for the next turn|
|5|**Juggle**|Gain 1 Block for this turn when a minion is replayed|

\---

# The Crab

The Crab takes advantage of discarding cards by having cards that are played when they discard.

## Main Mechanics

* **Molt** — Whenever this card is discarded, it plays for free.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Little Splash**|Deal 6 Damage|
|2|**Pinch**|*Molt* — Deal 4 Damage|
|3|**Quicksand**|Discard 1, Deal 2 Damage|
|4|**Blend In**|Deal 4 Damage, Gain 2 Shields|
|5|**Smack**|Deal 2 Damage — The next card you discard with Molt is played twice|
|6|**Locator**|*Molt* — Deal 1 Damage for each card discarded this turn|
|7|**Swipe**|*Molt* — Draw 2 Cards, Deal 3 Damage|
|8|**Sand Kick**|Deal 3 Damage, Put this card back into your hand|
|9|**Tentacles**|Gain 1 Energy, Deal 2 Damage — Shuffle this into your draw pile|

## Skills

|#|Name|Effect|
|-|-|-|
|10|**Hermit**|*Molt* — Heal 2, Discard 1|
|11|**Steamroll**|Gain 2 Shields, Draw 1, Discard 1|
|12|**Snip**|Draw 2|
|13|**Waterspout**|Heal 1, Draw 1, Discard 1|
|14|**Glacial Melt**|*Molt* — Draw 1, Gain 1 Energy|
|15|**Hook**|*Molt* — Gain 2 Energy|
|16|**Ecdycis**|Draw 3|
|17|**Refresh**|Gain 1 Energy, Discard your hand, Draw 3 Cards|
|18|**Double Draw**|Draw 2, Discard 2|
|19|**Sandbed**|Heal 1, Gain 4 Shields|
|20|**An-Enemy**|Gain 1 Shield, Gain 1 Energy|
|21|**Boil**|Gain 1 Energy, Discard 3|
|22|**Pickle Pal**|*Molt* — Gain 5 Shields|
|23|**One Finger Touch**|Draw 3, Discard 1|
|24|**Crab Walk**|Shuffle your deck. Discard the top 3 Cards of your Draw Pile|
|25|**Marine Life**|When you draw a card this turn, draw it from your discard pile until it is emptied|
|26|**Filter Feed**|*Molt* — Choose a card in your hand. Put a copy of that card into your draw pile|
|27|**Dry Out**|Gain 4 Shields, Put a card from your discard pile into your draw pile|
|28|**Scuttle**|Discard 2. Whenever you play one of the cards discarded this way, deal 2 Damage to a random opponent|
|29|**Dungeon-ness**|Gain 3 Shields. Add Molt to a card in your hand|
|30|**Shell**|Gain 1 Energy. Your next card is played twice|
|31|**Low Tide**|*Molt* — Heal 1, Draw 1|
|32|**Skitter**|*Molt* — Add Molt to 2 Cards in your Hand|
|33|**Flying Fish**|The next time you discard, draw cards equal to the cards you discarded with the card used to discard|

## Persistents

|#|Name|Effect|
|-|-|-|
|34|**Giant Barnacle**|The first card you discard on your turn plays twice the next time it is played|
|35|**Exoskeleton**|If you have 5+ Defense at the end of your turn, discard your hand and draw 5 cards|
|36|**Decapod**|For Every 10 Cards you discard, deal 10 Damage to all opponents|
|37|**Crab Trap**|At the start of your turn, draw 1 additional card and gain 1 Additional Energy|
|38|**Eyestalks**|If you discard your entire hand on your turn, gain 2 Energy|
|39|**Decorator**|When you shuffle your deck, the top card of your draw pile gains Molt|
|40|**Prawn**|When you discard a card with Molt, deal 3 Damage to an opponent of your choice|

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
|10|**Empty Out**|Heal 1 — Gain 1 Energy — Remove 3 Clouds|
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
|3|**Fall**|Fog Clouds no longer force you to discard|
|4|**Summer**|If you start with over 3 energy on your turn, deal 4 damage to all opponents|
|5|**Wild Wind**|When a Cloud is removed it plays its effect before it goes away|
|6|**Windmill**|At the end of your turn, fill all empty Cloud Slots with Random Clouds|
|7|**Static**|Whenever a Lightning cloud is removed, deal 2 Damage to all opponents|

\---

# The Writer

The Writer banks **Craft** and spends it on Burn cards, which cost Craft instead of energy.

## Main Mechanics

* **Craft** — Gain X Craft. Does Not go Away at the end of your turn.
* **Burn** — Costs X Craft to play this card. This card does not cost energy to play.
* **Fading** — If this card is in your hand at the end of your turn, it is discarded.
* **Bravery** — The first block card you play gives you X additional block.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Pen Stab**|Deal 3 Damage — Craft 2|
|2|**Reframe**|*Fading* — Deal 1 Damage — Craft 3|
|3|**Dispose**|Deal 4 Damage — Draw 3 Cards|
|4|**Dumpster Diver**|Burn All — Deal Damage Equal to Craft Burnt this Way|
|5|**Type**|*Fading* — Burn 3 — Deal 5 Damage|
|6|**Junk**|Deal 2 Damage — Craft 1 — Gain 2 Bravery|
|7|**Rescue**|Burn 5 — Draw 2 Cards — Deal 6 Damage|
|8|**Brain Storm**|Deal Damage Equal to your Bravery — Set your Bravery to 0|
|9|**Search**|Deal 4 Damage — Gain 1 Energy — Add Fading to a card in your hand|
|10|**Uncreative**|Gain 1 Energy — At the end of this turn, Deal 2 Damage for each Fading card played this turn|

## Cards

|#|Name|Effect|
|-|-|-|
|11|**Quill**|*Fading* — Gain 1 Shield — Craft 2|
|12|**Look**|Craft 3 — Gain 3 Bravery|
|13|**Notes**|Gain 2 Shields — Craft equal to the Shields gained from this card|
|14|**Rough Draft**|When you play a card this turn, Craft 1 — All Cards in your hand gain Fading until played|
|15|**Trophy**|Next turn, Gain 2 Shields and Craft 3|
|16|**Scribble**|Burn 1 — Gain 3 Shields|
|17|**Refresh**|Burn 2 — Gain 2 Energy — Draw 1|
|18|**Evade**|Burn 3 — Gain Bravery equal to the amount of Fading cards in your hand|
|19|**Trash Can**|Burn 4 — *Fading* — Heal 4|
|20|**Pull From the Hat**|Burn 5 — Craft 8|
|21|**Shredder**|*Fading* — Gain 3 Energy|
|22|**Writing Prompt**|*Fading* — Cards with Craft, Craft Double next turn|
|23|**Inspiration**|*Fading* — Burn 8 — Next turn, play all Fading cards for free|
|24|**Stack**|The Next Fading card you play plays twice|
|25|**Reset**|Gain 1 Energy — Draw 6 — Discard all Non-Fading cards drawn this way|
|26|**Playwright**|Burn 2 — Gain 4 Shields|
|27|**Gamble it All**|Double your Bravery — Lose all Defense|
|28|**Cheater**|Gain Bravery equal to your Defense, Set your Defense to Zero|
|29|**Podcast**|Gain 2 Bravery, Gain 1 Shield|
|30|**Well Rested**|Next turn, gain 1 Bravery and 1 Additional Energy|
|31|**Memoir**|Gain 4 Shields, Gain 1 Bravery|

## Persistents

|#|Name|Effect|
|-|-|-|
|32|**Ink**|When you Burn, deal 1 Damage to all opponents|
|33|**Shake Spear**|When you play a Fading card, a random Burn card in your hand becomes free to play that turn|
|34|**Direct**|When you play a Fading card, Craft 2 and lose 1 Bravery|
|35|**Whiteboard**|Craft 1 at the End of your Turn|
|36|**Paper Trail**|When you draw a Burn card, draw 1 card|
|37|**Ask AI**|Draw 1 Card when you draw a Fading card|
|38|**Editor**|\-5 Bravery — Gain 2 additional energy at the start of your turn|
|39|**Wordsmith**|When you Burn, gain 1 Shield|
|40|**Scribe**|Gain 1 Bravery for every two additional cards drawn on your turn|

\---

# The Old Lady

The Old Lady has the Lowest Attacks of any character, but makes up for it by increasing damage dealt.

## Main Mechanics

* **Blank** — Has no effects. Whenever this card is played, all Cards with "Add" are free to play until a non-Add/Blank card is played.
* **Add** — This card cannot be played regularly.
* **Power** — The first time you attack an enemy on your turn, deal X more damage. Power Decreases by 1 at the start of your turn.

## Attacks

|#|Name|Effect|
|-|-|-|
|1|**Sharp Strike**|Deal 1 Damage, Gain 1 Energy|
|2|**Smoke Bomb**|Gain 4 Shields, Deal 3 Damage, Gain 2 Power, Lose 1 HP|
|3|**Evil Glare**|Deal 5 Damage, Lose 1 HP|
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
|13|**Fear**|Gain 2 Power, Gain 2 Shields|
|14|**Blank Slate**|Blank|
|15|**Healthiness**|*Add* — Heal 1|
|16|**Air**|Blank|
|17|**Rest**|Heal 2, Gain 1 Energy|
|18|**Preparation**|*Add* — Gain 1 Energy|
|19|**Mystery**|Blank|
|20|**Chase Down**|*Add* — Draw 1|
|21|**Crossing Guard**|*Add* — Lose 2 HP, Gain 6 Shields|
|22|**Scare**|*Add* — Lose 1 HP, Gain 1 Energy|
|23|**Violent**|*Add* — Gain 3 Power|
|24|**Destroy**|*Add* — Lose 3 HP, Gain 2 Power next turn|
|25|**Papier Machette**|Clone a Blank card in your hand and add it to your draw pile|
|26|**Challenge**|You gain 3 Power, all opponents gain 1 Power|
|27|**Dash**|Gain 1 Power for each Blank card in your hand|
|28|**Fruit Juice**|*Add* — Heal 5|
|29|**Mend**|Gain 1 Energy — Lose all Power, Heal equal to Power Lost|
|30|**Mind Games**|Everyone gains 6 Shields, Gain 5 Power for one turn next turn|
|31|**Disguise**|Add a Random Blank card into your Discard Pile|
|32|**Retirement**|Lose 2 Power, Put Add on a card in your hand|

## Persistents

|#|Name|Effect|
|-|-|-|
|33|**Payback**|If you play a card that deals over 4 damage, Heal 3|
|34|**Sharpen**|When you Lose HP on your turn, gain 1 Power|
|35|**Crossword**|When you play a Blank card, gain 1 Energy|
|36|**Explosives**|Power no longer decreases at the end of your turn|
|37|**Arson**|The First card you Add each turn is played twice|
|38|**Fletching**|At the start of your turn, Lose 1 HP and Gain 1 Power|
|39|**Time Heals all Wounds**|When you Create a Blank Card, deal 2 Damage to a Random Enemy|
|40|**Revenge**|When you Add a card, Deal 1 Damage|

\---

# Relics

## General Relics

|#|Name|Effect|
|-|-|-|
|1|**Ripped Heart**|Start Combat with an additional 3 Max HP|
|2|**Sword**|Begin combat by dealing 4 Damage to a random opponent|
|3|**Brain Jar**|When you run out of cards, draw 4 cards instead of 3|
|4|**Old Shield**|Start combat with 5 Shields|
|5|**Calculator**|Start combat with 2 Energy|
|6|**Key**|At the start of combat, you can keep all 5 Cards Drawn|
|7|**Chest**|Start Combat with 25 Cards in your Draw Pile instead of 20|
|8|**Eye**|At the start of combat, Deal 3 Damage to all Opponents|
|9|**Hand**|The first time you gain Defense in combat, double that amount|
|10|**Urn**|At the end of your turn, Gain 1 Shield|

## Crab Relics

|#|Name|Effect|
|-|-|-|
|1|**Fossil**|At the start of combat, after drawing 5 cards, choose a card to add Molt to|
|2|**Toy Boat**|Attacks with Molt deal 1 Additional damage|
|3|**Fish Food**|When you play a card with discard, Gain 1 Shield|
|4|**Whale**|If you draw five or more cards on your turn, gain 1 energy|
|5|**Seashell**|At the start of combat, Draw 6 Cards and discard 2|

## Cloud Relics

|#|Name|Effect|
|-|-|-|
|1|**Lightning Rod**|At the start of combat, Create 1 Lightning Cloud|
|2|**Smokepipe**|At the start of combat, Create 1 Fog Cloud|
|3|**Raindrop**|At the start of combat, Create 1 Storm Cloud|
|4|**Snow Globe**|At the start of combat, Create 1 Snow Cloud|
|5|**Compass**|At the start of combat, Begin with 1 Persistent Card|

## Wizard Relics

|#|Name|Effect|
|-|-|-|
|1|**Vial**|Start Combat with 3 Poison|
|2|**Leaky Potion**|Poison decreases by 1 Each turn. Venom and Drink have 50% More Effect|
|3|**Magic Wand**|Start combat with an additional random Minion|
|4|**Frog Leg**|The first time you use Venom, retain your Poison|
|5|**Thorn**|When you gain Defense, Deal 2 Damage to a random opponent|

## Writer Relics

|#|Name|Effect|
|-|-|-|
|1|**Typewriter**|Draw 1 Additional Card on your turn|
|2|**Notebook**|Craft 3 at the start of combat|
|3|**Script**|Your first hand of combat starts with Fading|
|4|**Highlighter**|The first Burn card has \-2 Cost|
|5|**Pencil**|Start combat with 1 Bravery|

## Old Lady Relics

|#|Name|Effect|
|-|-|-|
|1|**Cookie Jar**|The first time in combat you lose HP on your turn, Heal 3|
|2|**Earring**|Start Combat with 2 Power|
|3|**Cane**|Begin combat with 1 additional Blank card in your hand|
|4|**Pearl Necklace**|If you play 2 or more Blank cards on your turn, deal 4 Damage to a Random Opponent|
|5|**Quilt**|Every 2 Turns, Heal 1|

## Knight Relics

|#|Name|Effect|
|-|-|-|
|1|**Rusty Sword**|At the Start of Combat, all Attacks in your Hand are Marked with Sharp 1|
|2|**King's Crown**|For Every 5 Cards Drawn on your turn, Deal 1 Damage to all Opponents|
|3|**Candle**|A Random Card in your Starting Hand is Marked with Flaming 2|
|4|**Chestplate**|The First time you Play a Skill Card, it is Marked with Sturdy 1|
|5|**Knife (For Stabbing)**|Marked Attack Cards Deal \+1 Damage the first time they are played|
