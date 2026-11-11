import type { LocaleDictionary } from './types';

/**
 * Полный английский словарь локализации Balite (сеттинг «Руническая Алхимия и Астрология», 6+/12+).
 */
export const EN_DICTIONARY: LocaleDictionary = {
  ui: {
    app: {
      title: 'Balite',
      subtitle: 'Runic Alchemy & Astrology',
      portraitHint: 'Designed for 720×1280 portrait',
    },
    hud: {
      stage: 'Stage {ante}',
      stageWithMax: 'Stage {ante}/{maxAnte}',
      endlessStage: 'Endless Stage {ante}',
      round: 'Round {round}',
      score: 'Score',
      target: 'Target',
      scoreProgress: '{score} / {target}',
      layout: 'Hand Layout',
      levelShort: 'Lv. {level}',
      power: 'Power',
      powerShort: 'Pwr',
      mult: 'Mult',
      multShort: 'Mult',
      hands: 'Hands',
      discards: 'Discards',
      gold: 'Gold',
      goldAmount: '{dollars} Gold',
      relics: 'Relics',
      consumables: 'Consumables',
      slotsCount: '{count}/{max}',
      deck: 'Deck',
      activeTags: 'Tags',
      abilityDisabled: 'Ability Disabled',
      debuffedBadge: 'Debuffed',
      royalFlush: 'Royal Flush',
      previewHint: 'Select up to 5 cards',
    },
    actions: {
      playHand: 'Play Hand',
      discard: 'Discard',
      sort: 'Sort',
      sortByRank: 'By Rank',
      sortBySuit: 'By Suit',
      deckButton: 'Deck ({remaining}/{total})',
      handReference: 'Layouts',
      settings: 'Settings',
      info: 'Info',
      sell: 'Sell for {dollars} Gold',
      use: 'Use',
      buy: 'Buy ({dollars} Gold)',
      buyAndUse: 'Buy & Use',
      openPack: 'Open ({dollars} Gold)',
      moveLeft: '◀ Left',
      moveRight: 'Right ▶',
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      skip: 'Skip',
      battle: 'Battle',
      rerollBoss: 'Reroll Boss ({dollars} Gold)',
      claimCashout: 'Claim {dollars} Gold',
      rerollShop: 'Reroll ({dollars} Gold)',
      nextRound: 'Next',
      skipPack: 'Skip Pack',
      pickItem: 'Pick',
      startRun: 'Start Run',
      continueRun: 'Continue Run',
      newRun: 'New Run',
      continueEndless: 'Endless Mode',
      playAgain: 'Play Again',
      toDeckSelect: 'Deck Select',
    },
    selection: {
      upToCards: 'Select up to {max} cards ({count}/{max} selected)',
      exactCards: 'Select exactly {exact} cards ({count}/{exact} selected)',
      singleCard: 'Select {exact} card ({count}/{exact} selected)',
      mirrorCards: 'Select {exact} cards: left becomes a copy of right ({count}/{exact})',
    },
    deckSelect: {
      title: 'Choose Starting Deck',
      seedLabel: 'Run Seed',
      randomSeed: 'Random',
      seedPlaceholder: 'Enter seed or leave blank',
      unlocked: 'Unlocked',
      locked: 'Locked',
    },
    blindSelect: {
      title: 'Stage {ante} Guardians',
      current: 'Current',
      defeated: 'Defeated',
      skipped: 'Skipped',
      upcoming: 'Upcoming',
      reward: 'Reward: {dollars} Gold',
      target: 'Target: {score}',
      skipWithTag: 'Skip -> {tag}',
      showdownBadge: 'Showdown Boss',
      cannotSkipBoss: 'Boss cannot be skipped',
    },
    cashout: {
      title: 'Guardian Defeated!',
      guardianReward: 'Guardian Reward',
      unusedHands: 'Remaining Hands ({count})',
      interest: 'Interest (1 Gold per 5 Gold)',
      relicBonus: 'Relic Bonus',
      tagBonus: 'Tag Bonus',
      total: 'Total',
    },
    shop: {
      title: 'Alchemist Shop',
      shelfTitle: 'Offers',
      charterTitle: 'Guild Charter',
      packsTitle: 'Booster Packs',
      sold: 'Sold',
      noSlots: 'No free slots',
      notEnoughGold: 'Not enough Gold',
      free: 'Free',
      charterEmpty: 'Stage Charter already claimed',
    },
    booster: {
      picksLeft: 'Picks left: {count}',
      choosePattern: 'Choose {choose} of {total}',
      handCardsTitle: 'Cards in Hand',
    },
    settings: {
      title: 'Settings',
      animationSpeed: 'Animation Speed',
      speed1x: '1x',
      speed2x: '2x',
      speed4x: '4x',
      sound: 'Sound',
      soundOn: 'On',
      soundOff: 'Off',
      musicVolume: 'Music Volume',
      sfxVolume: 'SFX Volume',
      language: 'Language',
      langRu: 'Русский',
      langEn: 'English',
    },
    handReference: {
      title: 'Hand Layout Reference',
      level: 'Lv. {level}',
      played: 'Played: {count}',
      baseFormula: '{chips} Pwr × {mult} Mult',
      hiddenLayout: 'Hidden Layout',
    },
    deckModal: {
      title: 'Deck Overview',
      drawPile: 'Draw Pile ({count})',
      discardPile: 'Discard Pile ({count})',
      inHand: 'In Hand ({count})',
      totalCards: 'Total cards: {count}',
    },
    runEnd: {
      victoryTitle: 'Victory!',
      victorySubtitle: 'All 8 Stages cleared!',
      defeatTitle: 'Defeat',
      defeatSubtitle: 'Guardian target score not reached',
      bestHandScore: 'Best Hand Score',
      handsPlayed: 'Hands Played',
      discardsUsed: 'Discards Used',
      cardsDestroyed: 'Cards Destroyed',
      dollarsSpent: 'Gold Spent',
      finalStage: 'Stage Reached',
      finalRound: 'Round',
      runSeed: 'Seed',
    },
  },
  hands: {
    'Flush Five': {
      name: 'Flush Five',
      description: '5 cards of the same rank and suit',
    },
    'Flush House': {
      name: 'Flush House',
      description: 'Three of a Kind and a Pair, all of the same suit',
    },
    'Five of a Kind': {
      name: 'Five of a Kind',
      description: '5 cards of the same rank',
    },
    'Straight Flush': {
      name: 'Straight Flush',
      description: '5 consecutive cards of the same suit',
    },
    'Four of a Kind': {
      name: 'Four of a Kind',
      description: '4 cards of the same rank',
    },
    'Full House': {
      name: 'Full House',
      description: 'Three of a Kind and a Pair of different ranks',
    },
    Flush: {
      name: 'Flush',
      description: '5 cards of the same suit',
    },
    Straight: {
      name: 'Straight',
      description: '5 consecutive cards by rank',
    },
    'Three of a Kind': {
      name: 'Three of a Kind',
      description: '3 cards of the same rank',
    },
    'Two Pair': {
      name: 'Two Pair',
      description: 'Two pairs of cards of different ranks',
    },
    Pair: {
      name: 'Pair',
      description: '2 cards of the same rank',
    },
    'High Card': {
      name: 'High Card',
      description: 'Highest card when no other layout is formed',
    },
  },
  relics: {
    j_joker: {
      name: 'Waystone',
      description: '+{mult} Mult',
    },
    j_greedy_joker: {
      name: 'Diamond Brooch',
      description: '+{mult} Mult for each played Diamond when scored',
    },
    j_lusty_joker: {
      name: 'Heartwood Charm',
      description: '+{mult} Mult for each played Heart when scored',
    },
    j_wrathful_joker: {
      name: 'Spearhead',
      description: '+{mult} Mult for each played Spade when scored',
    },
    j_gluttenous_joker: {
      name: 'Four-Leaf Clover',
      description: '+{mult} Mult for each played Club when scored',
    },
    j_jolly: {
      name: 'Twin Seal',
      description: '+{mult} Mult if played layout contains a Pair',
    },
    j_sly: {
      name: 'Concord Talisman',
      description: '+{chips} Power if played layout contains a Pair',
    },
    j_half: {
      name: 'Shattered Shield',
      description: '+{mult} Mult if played layout has {maxCards} or fewer cards',
    },
    j_abstract: {
      name: 'Sigil of Unity',
      description: '+{multPerRelic} Mult for each Relic owned (Currently +{mult})',
    },
    j_banner: {
      name: 'War Banner',
      description: '+{chipsPerDiscard} Power for each remaining discard',
    },
    j_mystic_summit: {
      name: 'Mystic Summit',
      description: '+{mult} Mult when {discards} discards remain',
    },
    j_scary_face: {
      name: 'Ancient Visage',
      description: '+{chips} Power for each face card (J, Q, K) when scored',
    },
    j_even_steven: {
      name: 'Scales of Parity',
      description: '+{mult} Mult for each even-rank card (10, 8, 6, 4, 2) when scored',
    },
    j_odd_todd: {
      name: 'Oddity Stone',
      description: '+{chips} Power for each odd-rank card (A, 9, 7, 5, 3) when scored',
    },
    j_runner: {
      name: 'Wayfarer Boots',
      description: 'Gains +{chipsStep} Power if played layout contains a Straight (Currently +{chips})',
    },
    j_green_joker: {
      name: 'Emerald Sprout',
      description: '+{multGain} Mult per hand played, -{multLoss} Mult per discard, min 0 (Currently +{mult})',
    },
    j_photograph: {
      name: 'Heirloom Locket',
      description: 'First scored face card (J, Q, K) gives ×{xMult} Mult',
    },
    j_golden: {
      name: 'Golden Chalice',
      description: 'Earn +{dollars} Gold at the end of each round',
    },
    j_flash: {
      name: 'Forge Flash',
      description: 'Gains +{multStep} Mult per shop reroll (Currently +{mult})',
    },
    j_trousers: {
      name: 'Spare Tunic',
      description: 'Gains +{multStep} Mult if played layout contains Two Pair (Currently +{mult})',
    },
    j_ceremonial: {
      name: 'Smelting Blade',
      description:
        'When choosing a Guardian, absorbs the Relic to the right and adds double its sell value to Mult (Currently +{mult})',
    },
    j_blackboard: {
      name: 'Slate Board',
      description: '×{xMult} Mult if all cards held in hand are Spades or Clubs',
    },
    j_card_sharp: {
      name: 'Honed Crest',
      description: '×{xMult} Mult if this layout type has already been played this round',
    },
    j_acrobat: {
      name: 'Tightrope Walker',
      description: '×{xMult} Mult on the final hand of the round',
    },
    j_constellation: {
      name: 'Celestial Compass',
      description: 'Gains +×{xMultStep} Mult for every Astral Sphere used (Currently ×{xMult})',
    },
    j_hologram: {
      name: 'Memory Prism',
      description: 'Gains +×{xMultStep} Mult every time a card is added to your deck (Currently ×{xMult})',
    },
    j_vampire: {
      name: 'Spell Siphon',
      description:
        'Gains +×{xMultStep} Mult per scoring Enhanced card played and removes its Enhancement (Currently ×{xMult})',
    },
    j_ramen: {
      name: 'Spiced Elixir',
      description: '×{xMult} Mult; loses ×{xMultLoss} per card discarded (vanishes at ×1)',
    },
    j_stencil: {
      name: 'Hollow Cast',
      description: '×1 Mult for each empty Relic slot, counting itself as empty (Currently ×{xMult})',
    },
    j_sock_and_buskin: {
      name: 'Twin Mask',
      description: 'Retrigger (+{retriggers}) all played face cards (J, Q, K)',
    },
    j_mime: {
      name: 'Mirror Mime',
      description: 'Retrigger (+{retriggers}) all abilities of cards held in hand',
    },
    j_four_fingers: {
      name: 'Fourfold Prism',
      description: 'All Flushes and Straights can be made with {cardsRequired} cards',
    },
    j_shortcut: {
      name: 'Secret Path',
      description: 'Allows Straights to be made with gaps of 1 rank (e.g., A-Q-10-8-6)',
    },
    j_bull: {
      name: 'Brazen Bull',
      description: '+{chipsPerDollar} Power for every 1 Gold you have (Currently +{chips})',
    },
    j_duo: {
      name: 'Oath of Twins',
      description: '×{xMult} Mult if played layout contains a Pair',
    },
    j_tribe: {
      name: 'Unity of the Clan',
      description: '×{xMult} Mult if played layout contains a Flush',
    },
    j_baron: {
      name: 'Monarch Crown',
      description: 'Each King held in hand gives ×{xMult} Mult',
    },
    j_blueprint: {
      name: 'Master Blueprint',
      description: 'Copies the ability of the compatible Relic to the right',
    },
    j_brainstorm: {
      name: 'Spark of Insight',
      description: 'Copies the ability of the leftmost compatible Relic',
    },
    j_vagabond: {
      name: 'Ascetic',
      description: 'Creates a random Scroll if a hand is played with {maxDollars} Gold or less',
    },
  },
  celestials: {
    c_mercury: {
      name: 'Mercury',
      description: 'Level up Pair (+{chips} Power, +{mult} Mult)',
    },
    c_venus: {
      name: 'Venus',
      description: 'Level up Three of a Kind (+{chips} Power, +{mult} Mult)',
    },
    c_earth: {
      name: 'Earth',
      description: 'Level up Full House (+{chips} Power, +{mult} Mult)',
    },
    c_mars: {
      name: 'Mars',
      description: 'Level up Four of a Kind (+{chips} Power, +{mult} Mult)',
    },
    c_jupiter: {
      name: 'Jupiter',
      description: 'Level up Flush (+{chips} Power, +{mult} Mult)',
    },
    c_saturn: {
      name: 'Saturn',
      description: 'Level up Straight (+{chips} Power, +{mult} Mult)',
    },
    c_uranus: {
      name: 'Uranus',
      description: 'Level up Two Pair (+{chips} Power, +{mult} Mult)',
    },
    c_neptune: {
      name: 'Neptune',
      description: 'Level up Straight Flush (+{chips} Power, +{mult} Mult)',
    },
    c_pluto: {
      name: 'Pluto',
      description: 'Level up High Card (+{chips} Power, +{mult} Mult)',
    },
    c_planet_x: {
      name: 'Planet X',
      description: 'Level up Five of a Kind (+{chips} Power, +{mult} Mult)',
    },
    c_ceres: {
      name: 'Ceres',
      description: 'Level up Flush House (+{chips} Power, +{mult} Mult)',
    },
    c_eris: {
      name: 'Eris',
      description: 'Level up Flush Five (+{chips} Power, +{mult} Mult)',
    },
  },
  scrolls: {
    c_fool: {
      name: 'Scroll of Echoes',
      description: 'Creates a copy of the last Scroll or Astral Sphere used this run (excluding itself)',
    },
    c_magician: {
      name: 'Scroll of Fortune',
      description: 'Enhances up to {count} selected cards to Blessed Cards',
    },
    c_empress: {
      name: 'Scroll of Flame',
      description: 'Enhances up to {count} selected cards to Blazing Cards',
    },
    c_heirophant: {
      name: 'Scroll of Runes',
      description: 'Enhances up to {count} selected cards to Runic Cards',
    },
    c_lovers: {
      name: 'Scroll of Harmony',
      description: 'Enhances {count} selected card into a Chameleon Card',
    },
    c_chariot: {
      name: 'Scroll of the Smith',
      description: 'Enhances {count} selected card into a Steel Card',
    },
    c_justice: {
      name: 'Scroll of Crystal',
      description: 'Enhances {count} selected card into a Crystal Card',
    },
    c_devil: {
      name: 'Scroll of Midas',
      description: 'Enhances {count} selected card into a Gold Card',
    },
    c_tower: {
      name: 'Scroll of the Bastion',
      description: 'Enhances {count} selected card into a Stone Card',
    },
    c_hermit: {
      name: 'Scroll of Thrift',
      description: 'Doubles your current Gold (up to +{maxDollars} Gold)',
    },
    c_temperance: {
      name: 'Scroll of Appraisal',
      description: 'Grants Gold equal to the total sell value of all current Relics (up to +{maxDollars} Gold)',
    },
    c_wheel_of_fortune: {
      name: "Alchemist's Wheel",
      description: '1 in {odds} chance to add Foil, Holographic, or Polychrome Edition to a random Relic',
    },
    c_strength: {
      name: 'Scroll of Ascension',
      description: 'Increases rank of up to {count} selected cards by +1 (A -> 2)',
    },
    c_hanged_man: {
      name: 'Scroll of Cleansing',
      description: 'Destroys up to {count} selected cards',
    },
    c_death: {
      name: 'Scroll of Mirrors',
      description: 'Select {count} cards; converts the left card into an exact copy of the right card',
    },
    c_judgement: {
      name: 'Scroll of Summoning',
      description: 'Creates a random Relic if there is an open slot',
    },
  },
  runes: {
    c_talisman: {
      name: 'Rune of the Talisman',
      description: 'Adds a Gold Seal to {count} selected card in your hand',
    },
    c_deja_vu: {
      name: 'Crimson Rune',
      description: 'Adds a Crimson Seal to {count} selected card in your hand',
    },
    c_trance: {
      name: 'Azure Rune',
      description: 'Adds an Azure Seal to {count} selected card in your hand',
    },
    c_medium: {
      name: 'Violet Rune',
      description: 'Adds a Violet Seal to {count} selected card in your hand',
    },
    c_aura: {
      name: 'Rune of Radiance',
      description: 'Adds Foil, Holographic, or Polychrome Edition to {count} selected card',
    },
    c_cryptid: {
      name: 'Rune of Echoed Form',
      description: 'Creates {copies} copies of {count} selected card in your hand',
    },
    c_immolate: {
      name: 'Rune of Ash',
      description: 'Destroys {destroyCount} random cards in hand and grants +{dollars} Gold',
    },
    c_hex: {
      name: 'Prism Rune',
      description: 'Adds Polychrome Edition to a random Relic and destroys all other Relics',
    },
    c_black_hole: {
      name: 'Starlight Rift',
      description: 'Upgrades all 12 Hand Layouts by +{levels} level',
    },
  },
  charters: {
    v_overstock_norm: {
      name: 'Expanded Counter',
      description: '+{slots} offer slot available in the shop',
    },
    v_clearance_sale: {
      name: 'Guild Discount',
      description: 'All cards and packs in the shop are {percent}% off',
    },
    v_hone: {
      name: 'Fine Faceting',
      description: 'Foil, Holographic, and Polychrome cards appear {rate}x more often',
    },
    v_reroll_surplus: {
      name: 'Merchant Favor',
      description: 'Shop rerolls cost {dollars} Gold less',
    },
    v_crystal_ball: {
      name: 'Alchemist Belt',
      description: '+{slots} consumable slot',
    },
    v_grabber: {
      name: 'Arcane Reserve',
      description: '+{hands} hand every round',
    },
    v_wasteful: {
      name: 'Fresh Breeze',
      description: '+{discards} discard every round',
    },
    v_seed_money: {
      name: 'Treasury Seal',
      description: 'Raises the cap on interest earned in each round to {cap} Gold',
    },
    v_paint_brush: {
      name: 'Broad Grasp',
      description: '+{size} hand size',
    },
    v_telescope: {
      name: 'Astrolabe',
      description: 'Celestial Packs always contain the Astral Sphere for your most played Hand Layout',
    },
    v_observatory: {
      name: 'Observatory',
      description: 'Astral Spheres in your consumable slots give ×{xMult} Mult for their specified Hand Layout',
    },
    v_directors_cut: {
      name: 'Charter of Challenge',
      description: 'Reroll the Stage Boss 1 time per Stage for {dollars} Gold',
    },
  },
  tags: {
    tag_uncommon: {
      name: 'Uncommon Tag',
      description: 'Next shop features a free Uncommon Relic',
    },
    tag_rare: {
      name: 'Rare Tag',
      description: 'Next shop features a free Rare Relic',
    },
    tag_investment: {
      name: 'Investment Tag',
      description: 'Grants +{dollars} Gold after defeating the Stage Boss',
    },
    tag_economy: {
      name: 'Treasury Tag',
      description: 'Doubles your current Gold (up to +{maxDollars} Gold)',
    },
    tag_coupon: {
      name: 'Fairground Tag',
      description: 'Initial offers and booster packs in the next shop are free',
    },
    tag_d_six: {
      name: 'Reroll Tag',
      description: 'Rerolls in the next shop start at 0 Gold',
    },
    tag_double: {
      name: 'Double Tag',
      description: 'Gives a copy of the next selected Tag (excluding Double Tag)',
    },
    tag_juggle: {
      name: 'Reach Tag',
      description: '+{size} hand size for the next round only',
    },
    tag_charm: {
      name: 'Scroll Tag',
      description: 'Immediately opens a free Mega Scroll Pack',
    },
    tag_skip: {
      name: 'Wayfarer Tag',
      description: 'Grants +{dollarsPerSkip} Gold per skipped Guardian this run',
    },
  },
  bosses: {
    bl_hook: {
      name: 'The Ravager',
      description: 'Discards {count} random cards from hand per hand played',
    },
    bl_manacle: {
      name: 'The Shackles',
      description: '-{count} hand size during this round',
    },
    bl_psychic: {
      name: 'The Strict Arbiter',
      description: 'Must play {count} cards',
    },
    bl_pillar: {
      name: 'The Pillar of Memory',
      description: 'Cards played previously this Stage are debuffed',
    },
    bl_club: {
      name: 'The Club Eclipse',
      description: 'All Club cards are debuffed',
    },
    bl_water: {
      name: 'The Drought',
      description: 'Start with 0 discards',
    },
    bl_wall: {
      name: 'The Great Bastion',
      description: 'Extra-large target score (×4 base)',
    },
    bl_flint: {
      name: 'The Flint Warden',
      description: 'Base Power and Mult of played layouts are halved',
    },
    bl_final_vessel: {
      name: 'Violet Monolith',
      description: 'Colossal final Stage threshold (×6 base)',
    },
    bl_final_bell: {
      name: 'Cerulean Chime',
      description: 'Forces 1 random card in hand to always be selected',
    },
  },
  blinds: {
    small: {
      name: 'Small Guardian',
      description: 'Initial Stage guardian (×1 target)',
    },
    big: {
      name: 'Big Guardian',
      description: 'Stronger Stage guardian (×1.5 target)',
    },
    boss: {
      name: 'Stage Boss',
      description: 'Main Stage Guardian with a special rule',
    },
  },
  decks: {
    b_red: {
      name: 'Crimson Deck',
      description: '+{discards} discard every round',
    },
    b_blue: {
      name: 'Azure Deck',
      description: '+{hands} hand every round',
    },
    b_yellow: {
      name: 'Amber Deck',
      description: 'Start run with an extra +{dollars} Gold',
    },
    b_black: {
      name: 'Obsidian Deck',
      description: '+{relicSlots} Relic slot, -{handsLoss} hand every round',
    },
  },
  enhancements: {
    none: {
      name: 'Standard',
      description: 'No special enhancement',
    },
    bonus: {
      name: 'Runic',
      description: '+30 Power when scored',
    },
    mult: {
      name: 'Blazing',
      description: '+4 Mult when scored',
    },
    wild: {
      name: 'Chameleon',
      description: 'Can be used as any suit',
    },
    glass: {
      name: 'Crystal',
      description: '×2 Mult; 1 in 4 chance to shatter after scoring',
    },
    steel: {
      name: 'Steel',
      description: '×1.5 Mult while held in hand',
    },
    stone: {
      name: 'Stone',
      description: '+50 Power, no rank or suit; always scores',
    },
    gold: {
      name: 'Gold',
      description: '+3 Gold if held in hand at end of round',
    },
    lucky: {
      name: 'Blessed',
      description: '1 in 5 chance for +20 Mult and 1 in 15 chance for +20 Gold',
    },
  },
  editions: {
    base: {
      name: 'Base',
      description: 'Standard edition without modifiers',
    },
    foil: {
      name: 'Foil',
      description: '+50 Power',
    },
    holo: {
      name: 'Holographic',
      description: '+10 Mult',
    },
    polychrome: {
      name: 'Polychrome',
      description: '×1.5 Mult',
    },
    negative: {
      name: 'Shadow',
      description: '+1 Relic slot',
    },
  },
  seals: {
    none: {
      name: 'No Seal',
      description: 'No seal applied',
    },
    gold: {
      name: 'Gold Seal',
      description: 'Earn +3 Gold when this card is scored',
    },
    red: {
      name: 'Crimson Seal',
      description: 'Retrigger this card 1 time',
    },
    blue: {
      name: 'Azure Seal',
      description: 'Creates the Astral Sphere for final played layout if held in hand at end of round',
    },
    purple: {
      name: 'Violet Seal',
      description: 'Creates a Scroll when discarded',
    },
  },
  packTypes: {
    arcana: {
      name: 'Scroll Pack',
      description: 'Contains Alchemical Scrolls to alter cards and deck',
    },
    celestial: {
      name: 'Celestial Pack',
      description: 'Contains Astral Spheres to upgrade Hand Layouts',
    },
    standard: {
      name: 'Standard Pack',
      description: 'Contains playing cards to add to your deck',
    },
    buffoon: {
      name: 'Relic Pack',
      description: 'Contains random Relics to choose from',
    },
    spectral: {
      name: 'Ethereal Pack',
      description: 'Contains rare Ethereal Runes and Seals',
    },
  },
  packSizes: {
    normal: {
      name: 'Normal',
      description: 'Standard booster pack',
    },
    jumbo: {
      name: 'Jumbo',
      description: 'Expanded pack with more options',
    },
    mega: {
      name: 'Mega',
      description: 'Large pack allowing two picks',
    },
  },
  packs: {
    arcana_normal: 'Scroll Pack',
    arcana_jumbo: 'Jumbo Scroll Pack',
    arcana_mega: 'Mega Scroll Pack',
    celestial_normal: 'Celestial Pack',
    celestial_jumbo: 'Jumbo Celestial Pack',
    celestial_mega: 'Mega Celestial Pack',
    standard_normal: 'Standard Pack',
    standard_jumbo: 'Jumbo Standard Pack',
    standard_mega: 'Mega Standard Pack',
    buffoon_normal: 'Relic Pack',
    buffoon_jumbo: 'Jumbo Relic Pack',
    buffoon_mega: 'Mega Relic Pack',
    spectral_normal: 'Ethereal Pack',
    spectral_jumbo: 'Jumbo Ethereal Pack',
    spectral_mega: 'Mega Ethereal Pack',
  },
  suits: {
    spades: { name: 'Spades', short: 'S', symbol: '♠' },
    hearts: { name: 'Hearts', short: 'H', symbol: '♥' },
    clubs: { name: 'Clubs', short: 'C', symbol: '♣' },
    diamonds: { name: 'Diamonds', short: 'D', symbol: '♦' },
  },
  ranks: {
    '2': { name: '2', short: '2' },
    '3': { name: '3', short: '3' },
    '4': { name: '4', short: '4' },
    '5': { name: '5', short: '5' },
    '6': { name: '6', short: '6' },
    '7': { name: '7', short: '7' },
    '8': { name: '8', short: '8' },
    '9': { name: '9', short: '9' },
    '10': { name: '10', short: '10' },
    '11': { name: 'Jack', short: 'J' },
    '12': { name: 'Queen', short: 'Q' },
    '13': { name: 'King', short: 'K' },
    '14': { name: 'Ace', short: 'A' },
  },
  rarities: {
    '1': 'Common',
    '2': 'Uncommon',
    '3': 'Rare',
  },
  consumableKinds: {
    celestial: 'Astral Sphere',
    scroll: 'Alchemical Scroll',
    rune: 'Ethereal Rune',
  },
  trace: {
    card_chips: '+{chips} Power',
    card_mult: '+{mult} Mult',
    card_x_mult: '×{xMult} Mult',
    card_dollars: '+{dollars} Gold',
    card_retrigger: 'Again!',
    card_debuffed: 'Debuffed!',
    card_shatter_glass: 'Crystal shattered!',
    card_shatter_scroll: 'Card destroyed',
    card_shatter_rune: 'Turned to ash',
    card_enhancement_stripped: 'Enhancement absorbed',
    hand_card_steel: '×{xMult} Mult',
    hand_card_gold: '+{dollars} Gold',
    hand_card_blue_seal: 'Sphere created!',
    hand_card_purple_seal: 'Scroll created!',
    relic_chips: '+{chips} Power',
    relic_mult: '+{mult} Mult',
    relic_x_mult: '×{xMult} Mult',
    relic_dollars: '+{dollars} Gold',
    relic_upgrade: 'Upgrade!',
    relic_reset: 'Reset!',
    relic_destroyed_ceremonial: 'Absorbed!',
    relic_destroyed_ramen: 'Drained!',
    relic_destroyed_hex: 'Destroyed!',
    relic_destroyed_sold: 'Sold',
    relic_scroll_created: 'Scroll created!',
    consumable_used: 'Activated',
    consumable_nope: 'Nope!',
    consumable_all_hands_up: 'All layouts +{levels} Lv.!',
    hand_level_up: '{handName}: Lv. {level}',
    hand_debuffed: 'Layout blocked by Boss!',
    boss_disabled: 'Boss ability disabled!',
    boss_hook_discard: 'Boss discarded {count} cards',
    boss_manacle: 'Hand size -{count}',
    boss_psychic: 'Must play {count} cards!',
    boss_water: 'Discards set to 0!',
    boss_flint: 'Base Power & Mult halved!',
    boss_final_bell: 'Card forced selected!',
    tag_activated: 'Tag triggered: {tagName}',
    tag_copied: 'Tag copied: {tagName}',
    tag_fizzled: 'Tag had no effect',
    blind_defeated: 'Guardian defeated!',
    run_won: 'Victory on Stage {ante}!',
    run_lost: 'Defeat on Stage {ante}',
  },
};
