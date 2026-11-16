import type { LocaleDictionary } from './types';

/**
 * Полный английский словарь локализации Balite (сеттинг «Гильдия приключенцев», 6+/12+).
 */
export const EN_DICTIONARY: LocaleDictionary = {
  ui: {
    app: {
      title: 'Balite',
      subtitle: 'Adventurers’ Guild',
      portraitHint: 'Designed for 720×1280 portrait',
    },
    mainMenu: {
      play: 'Play',
      options: 'Options',
      collection: 'Collection',
      comingSoon: 'Soon',
      version: 'Version {version}',
    },
    collection: {
      title: 'Collection',
      relics: 'Relics',
      decks: 'Decks',
      vouchers: 'Charters',
      consumablesGroup: 'CONSUMABLES',
      scrolls: 'Forge Scrolls',
      celestials: 'Celestial Tomes',
      runes: 'Pandora Cards',
      enhancements: 'Card Enhancements',
      seals: 'Seals',
      editions: 'Editions',
      packs: 'Chests',
      tags: 'Tags',
      blinds: 'Quests and Bosses',
      back: 'Back',
      pageInfo: 'Page {current}/{total}',
      notDiscoveredTitle: 'Not Discovered',
      notDiscoveredDesc: 'Buy or use this card in an unseeded run to discover its effect',
      lockedTitle: 'Locked',
      enhancementRuleNotice: 'Each playing card can have at most one enhancement, edition and seal',
      anteBaseTitle: 'FLOOR',
      baseScoreTitle: 'BASE',
      voucherConditions: {
        spend2500: 'Spend $2500 total in the shop ({current})',
        reroll50: 'Reroll the shop 50 times ({current})',
        use50Celestials: 'Use 50 celestial tomes ({current})',
        play250Hands: 'Play 250 hands ({current})',
        earn400Dollars: 'Earn $400 in a single run ({current})',
        defeat10Bosses: 'Defeat 10 bosses ({current})',
      },
    },
    hud: {
      stage: 'Floor {ante}',
      stageWithMax: 'Floor {ante}/{maxAnte}',
      endlessStage: 'Floor {ante} (Endless)',
      rankWithMax: 'Floor {ante} ({ante}/{maxAnte})',
      endlessRank: 'Floor {ante} (Endless)',
      round: 'Battle {round}',
      score: 'Score',
      target: 'Target',
      scoreProgress: '{score} / {target}',
      layout: 'Combo',
      levelShort: 'Lv. {level}',
      power: 'Power',
      powerShort: 'Pwr',
      mult: 'Mult',
      multShort: 'Mult',
      hands: 'Hands',
      discards: 'Discards',
      gold: 'Gold',
      goldAmount: '{dollars} Gold',
      relics: 'Skills',
      consumables: 'Consumables',
      slotsCount: '{count}/{max}',
      deck: 'Deck',
      activeTags: 'Tokens',
      abilityDisabled: 'Effect Disabled',
      debuffedBadge: 'Weakened',
      royalFlush: 'Royal Straight',
      previewHint: 'Select up to 5 cards',
      shopBannerTitle: 'GUILD',
      shopBannerSubtitle: 'Gear & Supplies',
      blindSelectBadge: 'Quest Board',
    },
    actions: {
      playHand: 'Play Hand',
      discard: 'Discard',
      sort: 'Sort',
      sortByRank: 'By Rank',
      sortBySuit: 'By Suit',
      deckButton: 'Deck ({remaining}/{total})',
      handReference: 'Combos',
      runInfo: 'Run Info',
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
      battle: 'Accept Quest',
      rerollBoss: 'Reroll Boss ({dollars} Gold)',
      claimCashout: 'Claim {dollars} Gold',
      rerollShop: 'Reroll ({dollars} Gold)',
      nextRound: 'Next',
      skipPack: 'Close Chest',
      pickItem: 'Take',
      startRun: 'Start Run',
      continueRun: 'Continue Run',
      newRun: 'New Run',
      continueEndless: 'Endless Mode',
      playAgain: 'Play Again',
      toDeckSelect: 'Deck Select',
      copy: 'Copy',
      copied: 'Copied',
      mainMenu: 'Main Menu',
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
      title: 'Floor {ante} Quests',
      rankTitle: 'Floor {ante} Quests',
      chooseNextPrompt: 'Choose a quest on the guild board',
      current: 'Current',
      defeated: 'Cleared',
      skipped: 'Skipped',
      upcoming: 'Upcoming',
      minScore: 'Score at least',
      reward: 'Reward: {dollars} Gold',
      target: 'Target: {score}',
      orSeparator: 'OR',
      skipButton: 'Skip Quest',
      skipWithTag: 'Skip -> {tag}',
      showdownBadge: 'Final Boss',
      cannotSkipBoss: 'Boss monsters cannot be skipped',
      advanceStageTitle: 'Rank Promotion',
      advanceStageDesc: 'Strengthen monsters, refresh quests',
    },
    cashout: {
      title: 'Quest Cleared!',
      guardianReward: 'Quest Reward',
      unusedHands: 'Remaining Hands ({count})',
      interest: 'Guild Interest (1 Gold per 5 Gold)',
      relicBonus: 'Skill Bonus',
      tagBonus: 'Token Bonus',
      total: 'Total',
    },
    shop: {
      title: 'Guild Counter',
      shelfTitle: 'Supplies',
      charterTitle: 'Guild Privilege',
      packsTitle: 'Chests',
      sold: 'Sold',
      noSlots: 'No free slots',
      notEnoughGold: 'Not enough Gold',
      free: 'Free',
      charterEmpty: 'Rank Privilege already claimed',
    },
    booster: {
      picksLeft: 'Picks left: {count}',
      choosePattern: 'Choose {choose} of {total}',
      handCardsTitle: 'Cards in Hand',
    },
    settings: {
      title: 'Settings',
      hubTitle: 'Options',
      hubSettings: 'Settings',
      hubStats: 'Stats',
      hubCredits: 'Credits',
      hubMainMenu: 'Main Menu',
      animationSpeed: 'Animation Speed',
      speed05x: '0.5x',
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
      crtMode: 'CRT Effect',
      crtOff: 'Off',
      crtLight: 'Light',
      crtOriginal: 'Original',
      resetTutorial: 'Restart Tutorial',
    },
    stats: {
      title: 'Stats',
      bestHand: 'Best Combo',
      highestRound: 'Highest Battle',
      highestStage: 'Highest Rank',
      mostPlayedHand: 'Most Played Combo',
      noneHand: 'None ({count})',
      maxGold: 'Max Gold',
      bestWinStreak: 'Best Win Streak',
      runsStartedWon: 'Runs / Wins',
      discoveryProgress: 'Collection Progress',
    },
    credits: {
      title: 'Credits & About',
      version: 'Build version: {version}',
      settingLine: 'Setting: Adventurers’ Guild (Isekai Fantasy)',
      engineLine: 'Game engine & UI: Balite Team (TypeScript, Web Canvas, SVG)',
      audioLine: 'Audio: hybrid Web Audio engine & procedural synthesis',
      fontLine: 'Font: Pixellari (by Zacchary Dempsey-Plante, Cyrillic by YuRaNnNzZZ, SIL OFL 1.1)',
      complianceLine: 'Web edition with no external links.',
    },
    handReference: {
      title: 'Combo Reference',
      level: 'Lv. {level}',
      played: 'Played: {count}',
      baseFormula: '{chips} Pwr × {mult} Mult',
      hiddenLayout: 'Hidden Combo',
    },
    runInfo: {
      title: 'Run Info',
      tabs: {
        hands: 'Hands',
        blinds: 'Orders',
        vouchers: 'Charters',
      },
      blinds: {
        defeated: 'Defeated',
        current: 'Current',
        upcoming: 'Upcoming',
        skipped: 'Skipped',
        minScore: 'Score at least',
        reward: 'Reward: {dollars}g',
        skipReward: 'Skip reward',
        bossCannotSkip: 'Boss cannot be skipped',
      },
      vouchers: {
        empty: 'No charters redeemed this run',
        title: 'Charters redeemed this run',
      },
      backButton: 'Back',
      handRules: {
        'High Card':
          'If played hand is not any of the above hands, only the highest ranked card scores',
        Pair: '2 cards of the same rank. May be played with up to 3 other unscored cards',
        'Two Pair': '2 pairs of cards of different ranks. May be played with 1 other unscored card',
        'Three of a Kind':
          '3 cards of the same rank. May be played with up to 2 other unscored cards',
        Straight: '5 cards in consecutive sequence',
        Flush: '5 cards of the same suit',
        'Full House': '3 cards of one rank and 2 cards of another rank',
        'Four of a Kind': '4 cards of the same rank. May be played with 1 other unscored card',
        'Straight Flush': '5 cards in consecutive sequence of the same suit',
        'Five of a Kind': '5 cards of the same rank',
        'Flush House': 'A Three of a Kind and a Pair of the same suit',
        'Flush Five': '5 cards of the same rank and suit',
      },
    },
    deckModal: {
      title: 'Deck Overview',
      remainingTab: 'Remaining',
      fullTab: 'Full Deck',
      baseCardsTitle: 'Base Cards',
      aces: 'Aces',
      faces: 'Face',
      numbers: 'Number',
      rankAce: 'A',
      rankKing: 'K',
      rankQueen: 'Q',
      rankJack: 'J',
      backButton: 'Back',
      drawPile: 'Draw Pile ({count})',
      discardPile: 'Discard Pile ({count})',
      inHand: 'In Hand ({count})',
      totalCards: 'Total cards: {count}',
    },
    runEnd: {
      victoryTitle: 'Victory!',
      victorySubtitle: 'All 8 Guild Ranks cleared!',
      defeatTitle: 'Quest Failed',
      defeatSubtitle: 'Quest target score not reached',
      bestHandScore: 'Best Combo Score',
      handsPlayed: 'Hands Played',
      discardsUsed: 'Discards Used',
      cardsDestroyed: 'Cards Destroyed',
      dollarsSpent: 'Gold Spent',
      finalStage: 'Rank Reached',
      finalRound: 'Battle',
      runSeed: 'Seed',
      mostPlayedHand: 'Most Played Combo',
      cardsPlayed: 'Cards Played',
      cardsDiscarded: 'Cards Discarded',
      cardsPurchased: 'Cards Purchased',
      rerollsCount: 'Rerolls',
      newDiscoveries: 'New Discoveries',
      defeatedBy: 'Failed Quest:',
      clearedGuardian: 'Cleared Quest:',
      newRecordBadge: 'New Best!',
      none: 'None ({count})',
    },
    tooltip: {
      hiddenTitle: 'Hidden Card',
      hiddenSubtitle: 'Face down',
      hiddenDescription: 'Hidden by Boss monster ability',
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
      description: 'Highest card when no other combo is formed',
    },
  },
  relics: {
    j_joker: {
      name: 'Basic Strike',
      description: '+{mult} Mult',
    },
    j_greedy_joker: {
      name: 'Gold Seeker',
      description: '+{mult} Mult for each played Diamond when scored',
    },
    j_lusty_joker: {
      name: 'Ardent Heart',
      description: '+{mult} Mult for each played Heart when scored',
    },
    j_wrathful_joker: {
      name: 'Blade Fury',
      description: '+{mult} Mult for each played Spade when scored',
    },
    j_gluttenous_joker: {
      name: 'Forest Ward',
      description: '+{mult} Mult for each played Club when scored',
    },
    j_jolly: {
      name: 'Twin Stance',
      description: '+{mult} Mult if played combo contains a Pair',
    },
    j_sly: {
      name: 'Clever Feint',
      description: '+{chips} Power if played combo contains a Pair',
    },
    j_half: {
      name: 'Swift Lunge',
      description: '+{mult} Mult if played hand has {maxCards} or fewer cards',
    },
    j_abstract: {
      name: 'Guild Synergy',
      description: '+{multPerRelic} Mult for each Skill owned (Currently +{mult})',
    },
    j_banner: {
      name: 'Siege Stance',
      description: '+{chipsPerDiscard} Power for each remaining discard',
    },
    j_mystic_summit: {
      name: 'Final Stand',
      description: '+{mult} Mult when {discards} discards remain',
    },
    j_scary_face: {
      name: 'Intimidation',
      description: '+{chips} Power for each face card (J, Q, K) when scored',
    },
    j_even_steven: {
      name: 'Even Rhythm',
      description: '+{mult} Mult for each even-rank card (10, 8, 6, 4, 2) when scored',
    },
    j_odd_todd: {
      name: 'Odd Strike',
      description: '+{chips} Power for each odd-rank card (A, 9, 7, 5, 3) when scored',
    },
    j_runner: {
      name: 'Adventurer Dash',
      description: 'Gains +{chipsStep} Power if played combo contains a Straight (Currently +{chips})',
    },
    j_green_joker: {
      name: 'Battle Tempering',
      description: '+{multGain} Mult per hand played, -{multLoss} Mult per discard, min 0 (Currently +{mult})',
    },
    j_photograph: {
      name: 'Keen Eye',
      description: 'First scored face card (J, Q, K) gives ×{xMult} Mult',
    },
    j_golden: {
      name: 'Guild Stipend',
      description: 'Earn +{dollars} Gold after clearing each quest',
    },
    j_flash: {
      name: 'Merchant Instinct',
      description: 'Gains +{multStep} Mult per counter reroll (Currently +{mult})',
    },
    j_trousers: {
      name: 'Spare Gear',
      description: 'Gains +{multStep} Mult if played combo contains Two Pair (Currently +{mult})',
    },
    j_ceremonial: {
      name: 'Skill Absorption',
      description:
        'When accepting a quest, absorbs the Skill to the right and adds double its sell value to Mult (Currently +{mult})',
    },
    j_blackboard: {
      name: 'Night Ambush',
      description: '×{xMult} Mult if all cards held in hand are Spades or Clubs',
    },
    j_card_sharp: {
      name: 'Repeat Technique',
      description: '×{xMult} Mult if this combo has already been played this battle',
    },
    j_acrobat: {
      name: 'Final Surge',
      description: '×{xMult} Mult on the final hand of the battle',
    },
    j_constellation: {
      name: 'Scholarly Study',
      description: 'Gains +×{xMultStep} Mult for every Combo Tome used (Currently ×{xMult})',
    },
    j_hologram: {
      name: 'Ally Summon',
      description: 'Gains +×{xMultStep} Mult every time a card is added to your deck (Currently ×{xMult})',
    },
    j_vampire: {
      name: 'Spell Drain',
      description:
        'Gains +×{xMultStep} Mult per scoring Enhanced card played and removes its Enhancement (Currently ×{xMult})',
    },
    j_ramen: {
      name: 'Hearty Ramen',
      description: '×{xMult} Mult; loses ×{xMultLoss} per card discarded (vanishes at ×1)',
    },
    j_stencil: {
      name: 'Blank Slate',
      description: '×1 Mult for each empty Skill slot, counting itself as empty (Currently ×{xMult})',
    },
    j_sock_and_buskin: {
      name: 'Echoing Form',
      description: 'Retrigger (+{retriggers}) all played face cards (J, Q, K)',
    },
    j_mime: {
      name: 'Second Wind',
      description: 'Retrigger (+{retriggers}) all abilities of cards held in hand',
    },
    j_four_fingers: {
      name: 'Fluid Technique',
      description: 'All Flushes and Straights can be made with {cardsRequired} cards',
    },
    j_shortcut: {
      name: 'Secret Maneuver',
      description: 'Allows Straights to be made with gaps of 1 rank (e.g., A-Q-10-8-6)',
    },
    j_bull: {
      name: 'Heavy Purse',
      description: '+{chipsPerDollar} Power for every 1 Gold you have (Currently +{chips})',
    },
    j_duo: {
      name: 'Twin Strike',
      description: '×{xMult} Mult if played combo contains a Pair',
    },
    j_tribe: {
      name: 'Guild Brotherhood',
      description: '×{xMult} Mult if played combo contains a Flush',
    },
    j_baron: {
      name: 'Royal Decree',
      description: 'Each King held in hand gives ×{xMult} Mult',
    },
    j_blueprint: {
      name: 'Technique Copy',
      description: 'Copies the ability of the compatible Skill to the right',
    },
    j_brainstorm: {
      name: 'Inherited Mastery',
      description: 'Copies the ability of the leftmost compatible Skill',
    },
    j_vagabond: {
      name: 'Penniless Wanderer',
      description: 'Creates a random Forge Scroll if a hand is played with {maxDollars} Gold or less',
    },
  },
  celestials: {
    c_mercury: {
      name: 'Tome of Dual Strikes',
      description: 'Level up Pair (+{chips} Power, +{mult} Mult)',
    },
    c_venus: {
      name: 'Tome of Triads',
      description: 'Level up Three of a Kind (+{chips} Power, +{mult} Mult)',
    },
    c_earth: {
      name: 'Tome of Full Formation',
      description: 'Level up Full House (+{chips} Power, +{mult} Mult)',
    },
    c_mars: {
      name: 'Tome of Quads',
      description: 'Level up Four of a Kind (+{chips} Power, +{mult} Mult)',
    },
    c_jupiter: {
      name: 'Tome of Unity',
      description: 'Level up Flush (+{chips} Power, +{mult} Mult)',
    },
    c_saturn: {
      name: 'Tome of Battle Lines',
      description: 'Level up Straight (+{chips} Power, +{mult} Mult)',
    },
    c_uranus: {
      name: 'Tome of Twin Pairs',
      description: 'Level up Two Pair (+{chips} Power, +{mult} Mult)',
    },
    c_neptune: {
      name: 'Tome of Vanguard',
      description: 'Level up Straight Flush (+{chips} Power, +{mult} Mult)',
    },
    c_pluto: {
      name: 'Tome of Basics',
      description: 'Level up High Card (+{chips} Power, +{mult} Mult)',
    },
    c_planet_x: {
      name: 'Secret Tome X',
      description: 'Level up Five of a Kind (+{chips} Power, +{mult} Mult)',
    },
    c_ceres: {
      name: 'Tome of Nobility',
      description: 'Level up Flush House (+{chips} Power, +{mult} Mult)',
    },
    c_eris: {
      name: 'Tome of Legends',
      description: 'Level up Flush Five (+{chips} Power, +{mult} Mult)',
    },
  },
  scrolls: {
    c_fool: {
      name: 'Forge Scroll of Echoes',
      description: 'Creates a copy of the last Forge Scroll or Combo Tome used this run (excluding itself)',
    },
    c_magician: {
      name: 'Scroll of Blessing',
      description: 'Enhances up to {count} selected cards to Blessed Cards',
    },
    c_empress: {
      name: 'Scroll of the Furnace',
      description: 'Enhances up to {count} selected cards to Blazing Cards',
    },
    c_heirophant: {
      name: 'Scroll of Tempering',
      description: 'Enhances up to {count} selected cards to Runic Cards',
    },
    c_lovers: {
      name: 'Scroll of Alloy',
      description: 'Enhances {count} selected card into a Chameleon Card',
    },
    c_chariot: {
      name: 'Scroll of Steelwork',
      description: 'Enhances {count} selected card into a Steel Card',
    },
    c_justice: {
      name: 'Scroll of Faceting',
      description: 'Enhances {count} selected card into a Crystal Card',
    },
    c_devil: {
      name: 'Scroll of Gilding',
      description: 'Enhances {count} selected card into a Gold Card',
    },
    c_tower: {
      name: 'Scroll of Masonry',
      description: 'Enhances {count} selected card into a Stone Card',
    },
    c_hermit: {
      name: 'Scroll of the Broker',
      description: 'Doubles your current Gold (up to +{maxDollars} Gold)',
    },
    c_temperance: {
      name: 'Scroll of Appraisal',
      description: 'Grants Gold equal to the total sell value of all current Skills (up to +{maxDollars} Gold)',
    },
    c_wheel_of_fortune: {
      name: 'Hammer of Luck',
      description: '1 in {odds} chance to add Foil, Holographic, or Polychrome Edition to a random Skill',
    },
    c_strength: {
      name: 'Scroll of Rank Up',
      description: 'Increases rank of up to {count} selected cards by +1 (A -> 2)',
    },
    c_hanged_man: {
      name: 'Scroll of Smelting',
      description: 'Destroys up to {count} selected cards',
    },
    c_death: {
      name: 'Scroll of Imprint',
      description: 'Select {count} cards; converts the left card into an exact copy of the right card',
    },
    c_judgement: {
      name: 'Scroll of Awakening',
      description: 'Creates a random Skill if there is an open slot',
    },
  },
  runes: {
    c_talisman: {
      name: 'Pandora: Gold Seal',
      description: 'Adds a Gold Seal to {count} selected card in your hand',
    },
    c_deja_vu: {
      name: 'Pandora: Crimson Seal',
      description: 'Adds a Crimson Seal to {count} selected card in your hand',
    },
    c_trance: {
      name: 'Pandora: Azure Seal',
      description: 'Adds an Azure Seal to {count} selected card in your hand',
    },
    c_medium: {
      name: 'Pandora: Violet Seal',
      description: 'Adds a Violet Seal to {count} selected card in your hand',
    },
    c_aura: {
      name: 'Pandora: Radiance',
      description: 'Adds Foil, Holographic, or Polychrome Edition to {count} selected card',
    },
    c_cryptid: {
      name: 'Pandora: Mirror Twin',
      description: 'Creates {copies} copies of {count} selected card in your hand',
    },
    c_immolate: {
      name: 'Pandora: Abyssal Flame',
      description: 'Destroys {destroyCount} random cards in hand and grants +{dollars} Gold',
    },
    c_hex: {
      name: 'Pandora: Prism of Risk',
      description: 'Adds Polychrome Edition to a random Skill and removes all other Skills',
    },
    c_black_hole: {
      name: 'Pandora: Ancient Gift',
      description: 'Upgrades all 12 Combos by +{levels} level',
    },
  },
  charters: {
    v_overstock_norm: {
      name: 'Expanded Counter',
      description: '+{slots} supply slot available at the Guild Counter',
    },
    v_clearance_sale: {
      name: 'Guild Discount',
      description: 'All cards and chests at the counter are {percent}% off',
    },
    v_hone: {
      name: 'Masterwork Faceting',
      description: 'Foil, Holographic, and Polychrome cards appear {rate}x more often',
    },
    v_reroll_surplus: {
      name: 'Quartermaster Access',
      description: 'Counter rerolls cost {dollars} Gold less',
    },
    v_crystal_ball: {
      name: 'Utility Pouch',
      description: '+{slots} consumable slot',
    },
    v_grabber: {
      name: 'Stamina Training',
      description: '+{hands} hand every battle',
    },
    v_wasteful: {
      name: 'Quick Redraw',
      description: '+{discards} discard every battle',
    },
    v_seed_money: {
      name: 'Guild Treasury Bond',
      description: 'Raises the cap on interest earned in each battle to {cap} Gold',
    },
    v_paint_brush: {
      name: 'Wide Grasp',
      description: '+{size} hand size',
    },
    v_telescope: {
      name: 'Archive Key',
      description: 'Tome Chests always contain the Combo Tome for your most played Combo',
    },
    v_observatory: {
      name: 'Library Pass',
      description: 'Combo Tomes in your consumable slots give ×{xMult} Mult for their specified Combo',
    },
    v_directors_cut: {
      name: 'Contract Swap',
      description: 'Reroll the Boss Monster 1 time per Rank for {dollars} Gold',
    },
  },
  tags: {
    tag_uncommon: {
      name: 'A-Rank Token',
      description: 'Next Guild Counter features a free Rank A Skill',
    },
    tag_rare: {
      name: 'S-Rank Token',
      description: 'Next Guild Counter features a free Rank S Skill',
    },
    tag_investment: {
      name: 'Bounty Token',
      description: 'Grants +{dollars} Gold after defeating the Boss Monster',
    },
    tag_economy: {
      name: 'Treasurer Token',
      description: 'Doubles your current Gold (up to +{maxDollars} Gold)',
    },
    tag_coupon: {
      name: 'Supply Token',
      description: 'Initial supplies and chests at the next Guild Counter are free',
    },
    tag_d_six: {
      name: 'Refresh Token',
      description: 'Rerolls at the next Guild Counter start at 0 Gold',
    },
    tag_double: {
      name: 'Double Token',
      description: 'Gives a copy of the next selected Token (excluding Double Token)',
    },
    tag_juggle: {
      name: 'Vigor Token',
      description: '+{size} hand size for the next battle only',
    },
    tag_charm: {
      name: 'Forge Token',
      description: 'Immediately opens a free Mega Forge Chest',
    },
    tag_skip: {
      name: 'Ranger Token',
      description: 'Grants +{dollarsPerSkip} Gold per skipped quest this run',
    },
  },
  bosses: {
    bl_hook: {
      name: 'Laplace',
      description: 'Discards {count} random cards from hand per hand played',
    },
    bl_manacle: {
      name: 'Fenrir',
      description: '-{count} hand size during this battle',
    },
    bl_psychic: {
      name: 'Kyubey',
      description: 'Must play {count} cards',
    },
    bl_pillar: {
      name: 'Mahoraga',
      description: 'Cards played previously at this Rank are weakened',
    },
    bl_club: {
      name: 'Goliath',
      description: 'All Club cards are weakened',
    },
    bl_water: {
      name: 'Kraken',
      description: 'Start battle with 0 discards',
    },
    bl_wall: {
      name: 'White Whale',
      description: 'Extra-large target score (×4 base)',
    },
    bl_flint: {
      name: 'Ifrit',
      description: 'Base Power and Mult of played combos are halved',
    },
    bl_final_vessel: {
      name: 'Storm Dragon',
      description: 'Colossal final Rank threshold (×6 base)',
    },
    bl_final_bell: {
      name: 'Orsted',
      description: 'Forces 1 random card in hand to always be selected',
    },
  },
  blinds: {
    small: {
      name: 'Slime',
      description: 'Standard guild quest (×1 target)',
    },
    big: {
      name: 'Goblin',
      description: 'Tough guild quest (×1.5 target)',
    },
    boss: {
      name: 'Boss Monster',
      description: 'Elite guild quest with a special rule',
    },
  },
  anteMonsters: {
    1: {
      small: { name: 'Slime', description: 'Standard Rank F quest (target ×1)' },
      big: { name: 'Goblin', description: 'Hard Rank F quest (target ×1.5)' },
    },
    2: {
      small: { name: 'Murloc', description: 'Standard Rank E quest (target ×1)' },
      big: { name: 'Kobold', description: 'Hard Rank E quest (target ×1.5)' },
    },
    3: {
      small: { name: 'Draugr', description: 'Standard Rank D quest (target ×1)' },
      big: { name: 'Orc', description: 'Hard Rank D quest (target ×1.5)' },
    },
    4: {
      small: { name: 'Mimic', description: 'Standard Rank C quest (target ×1)' },
      big: { name: 'Harpy', description: 'Hard Rank C quest (target ×1.5)' },
    },
    5: {
      small: { name: 'Stone Golem', description: 'Standard Rank B quest (target ×1)' },
      big: { name: 'Minotaur', description: 'Hard Rank B quest (target ×1.5)' },
    },
    6: {
      small: { name: 'Manticore', description: 'Standard Rank A quest (target ×1)' },
      big: { name: 'Wyvern', description: 'Hard Rank A quest (target ×1.5)' },
    },
    7: {
      small: { name: 'Draconian', description: 'Standard Rank S quest (target ×1)' },
      big: { name: 'Archdemon', description: 'Hard Rank S quest (target ×1.5)' },
    },
    8: {
      small: { name: 'Shadow Knight', description: 'Standard Rank SS quest (target ×1)' },
      big: { name: 'Harbinger of Ruin', description: 'Hard Rank SS quest (target ×1.5)' },
    },
  },
  decks: {
    b_red: {
      name: 'Crimson Deck',
      description: '+{discards} discard every battle',
    },
    b_blue: {
      name: 'Azure Deck',
      description: '+{hands} hand every battle',
    },
    b_yellow: {
      name: 'Amber Deck',
      description: 'Start run with an extra +{dollars} Gold',
    },
    b_black: {
      name: 'Obsidian Deck',
      description: '+{relicSlots} Skill slot, -{handsLoss} hand every battle',
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
      description: '+3 Gold if held in hand at end of battle',
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
      description: '+1 Skill slot',
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
      description: 'Creates the Combo Tome for final played combo if held in hand at end of battle',
    },
    purple: {
      name: 'Violet Seal',
      description: 'Creates a Forge Scroll when discarded',
    },
  },
  packTypes: {
    arcana: {
      name: 'Forge Chest',
      description: 'Contains Forge Scrolls to temper and alter cards',
    },
    celestial: {
      name: 'Tome Chest',
      description: 'Contains Combo Tomes to upgrade card combos',
    },
    standard: {
      name: 'Card Chest',
      description: 'Contains playing cards to add to your deck',
    },
    buffoon: {
      name: 'Skill Chest',
      description: 'Contains random Guild Skills to choose from',
    },
    spectral: {
      name: 'Pandora Chest',
      description: 'Contains rare high-risk Pandora Cards and Seals',
    },
  },
  packSizes: {
    normal: {
      name: 'Common',
      description: 'Standard guild chest',
    },
    jumbo: {
      name: 'Large',
      description: 'Expanded chest with more choices',
    },
    mega: {
      name: 'Mega',
      description: 'Rare chest allowing two picks',
    },
  },
  packs: {
    arcana_normal: 'Forge Chest',
    arcana_jumbo: 'Large Forge Chest',
    arcana_mega: 'Mega Forge Chest',
    celestial_normal: 'Tome Chest',
    celestial_jumbo: 'Large Tome Chest',
    celestial_mega: 'Mega Tome Chest',
    standard_normal: 'Card Chest',
    standard_jumbo: 'Large Card Chest',
    standard_mega: 'Mega Card Chest',
    buffoon_normal: 'Skill Chest',
    buffoon_jumbo: 'Large Skill Chest',
    buffoon_mega: 'Mega Skill Chest',
    spectral_normal: 'Pandora Chest',
    spectral_jumbo: 'Large Pandora Chest',
    spectral_mega: 'Mega Pandora Chest',
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
    '1': 'Rank B',
    '2': 'Rank A',
    '3': 'Rank S',
  },
  consumableKinds: {
    celestial: 'Combo Tome',
    scroll: 'Forge Scroll',
    rune: 'Pandora Card',
  },
  trace: {
    card_chips: '+{chips} Power',
    card_mult: '+{mult} Mult',
    card_x_mult: '×{xMult} Mult',
    card_dollars: '+{dollars} Gold',
    card_retrigger: 'Again!',
    card_debuffed: 'Weakened!',
    card_shatter_glass: 'Crystal shattered!',
    card_shatter_scroll: 'Card smelted',
    card_shatter_rune: 'Consumed by Abyss',
    card_enhancement_stripped: 'Enchantment drained',
    hand_card_steel: '×{xMult} Mult',
    hand_card_gold: '+{dollars} Gold',
    hand_card_blue_seal: 'Tome obtained!',
    hand_card_purple_seal: 'Scroll obtained!',
    relic_chips: '+{chips} Power',
    relic_mult: '+{mult} Mult',
    relic_x_mult: '×{xMult} Mult',
    relic_dollars: '+{dollars} Gold',
    relic_upgrade: 'Upgrade!',
    relic_reset: 'Reset!',
    relic_destroyed_ceremonial: 'Skill absorbed!',
    relic_destroyed_ramen: 'Ramen finished!',
    relic_destroyed_hex: 'Removed by Pandora!',
    relic_destroyed_sold: 'Sold',
    relic_scroll_created: 'Scroll created!',
    consumable_used: 'Activated',
    consumable_nope: 'Nope!',
    consumable_all_hands_up: 'All combos +{levels} Lv.!',
    hand_level_up: '{handName}: Lv. {level}',
    hand_debuffed: 'Combo blocked by Boss!',
    boss_disabled: 'Monster effect disabled!',
    boss_hook_discard: 'Monster discarded {count} cards',
    boss_manacle: 'Hand size -{count}',
    boss_psychic: 'Must play {count} cards!',
    boss_water: 'Discards set to 0!',
    boss_flint: 'Base Power & Mult halved!',
    boss_final_bell: 'Card forced selected!',
    tag_activated: 'Token triggered: {tagName}',
    tag_copied: 'Token copied: {tagName}',
    tag_fizzled: 'Token had no effect',
    blind_defeated: 'Quest cleared!',
    run_won: 'Victory at Guild Tier {ante}!',
    run_lost: 'Quest failed at Tier {ante}',
  },
};
