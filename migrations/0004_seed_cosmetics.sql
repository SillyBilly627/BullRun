-- ============================================================
-- BullRun — Seed Cosmetic Items (Battle Pass + Crate)
-- ============================================================
-- Populates the cosmetics table with all unlockable items.
-- Battle pass items unlock at specific levels.
-- Crate items are won from post-match spins.
-- ============================================================

-- ----------------------------------------
-- BATTLE PASS TITLES
-- ----------------------------------------
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Rookie Trader', 'title', 'common', 'Just getting started', 'title-rookie', 'battlepass', 2),
    ('Market Watch', 'title', 'common', 'Keeping an eye on the charts', 'title-marketwatch', 'battlepass', 3),
    ('Day Trader', 'title', 'uncommon', 'Living tick by tick', 'title-daytrader', 'battlepass', 5),
    ('Wolf of Wall St', 'title', 'uncommon', 'Hungry for profit', 'title-wolf', 'battlepass', 7),
    ('Market Shark', 'title', 'rare', 'Smells blood in the water', 'title-shark', 'battlepass', 10),
    ('Diamond Hands', 'title', 'rare', 'Never sells at a loss', 'title-diamond', 'battlepass', 13),
    ('Hedge Fund Manager', 'title', 'epic', 'Playing the big leagues', 'title-hedgefund', 'battlepass', 15),
    ('Market Mogul', 'title', 'epic', 'Money makes money', 'title-mogul', 'battlepass', 18),
    ('Bull King', 'title', 'legendary', 'Ruler of the market', 'title-bullking', 'battlepass', 20);

-- ----------------------------------------
-- BATTLE PASS BACKGROUNDS
-- ----------------------------------------
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Gradient Green', 'background', 'common', 'Subtle green gradient', 'bg-gradient-green', 'battlepass', 4),
    ('Gradient Blue', 'background', 'uncommon', 'Cool blue tones', 'bg-gradient-blue', 'battlepass', 6),
    ('Neon Grid', 'background', 'uncommon', '80s retro neon grid', 'bg-neon-grid', 'battlepass', 8),
    ('Matrix Rain', 'background', 'rare', 'Digital rain effect', 'bg-matrix', 'battlepass', 11),
    ('Northern Lights', 'background', 'epic', 'Aurora borealis shimmer', 'bg-aurora', 'battlepass', 14),
    ('Cosmic Stars', 'background', 'epic', 'Deep space starfield', 'bg-cosmic', 'battlepass', 17),
    ('Golden Crown', 'background', 'legendary', 'Royal golden backdrop', 'bg-golden', 'battlepass', 20);

-- ----------------------------------------
-- BATTLE PASS CARD STYLES
-- ----------------------------------------
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Silver Edge', 'card_style', 'uncommon', 'Clean silver border', 'card-silver', 'battlepass', 9),
    ('Gold Frame', 'card_style', 'rare', 'Shiny gold frame', 'card-gold', 'battlepass', 12),
    ('Neon Glow', 'card_style', 'epic', 'Pulsing neon outline', 'card-neon', 'battlepass', 16),
    ('Diamond Plate', 'card_style', 'legendary', 'Brilliant diamond border', 'card-diamond', 'battlepass', 19);

-- ----------------------------------------
-- CRATE TITLES
-- ----------------------------------------
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Lucky Dip', 'title', 'common', 'Feeling lucky?', 'title-lucky', 'crate', NULL),
    ('Penny Pincher', 'title', 'common', 'Every cent counts', 'title-penny', 'crate', NULL),
    ('Paper Hands', 'title', 'uncommon', 'Sold too early... again', 'title-paperhands', 'crate', NULL),
    ('YOLO Trader', 'title', 'uncommon', 'All in, no regrets', 'title-yolo', 'crate', NULL),
    ('To The Moon', 'title', 'rare', 'Rockets only go up', 'title-moon', 'crate', NULL),
    ('Whale Alert', 'title', 'epic', 'Big money moves', 'title-whale', 'crate', NULL),
    ('The Oracle', 'title', 'legendary', 'Sees the future', 'title-oracle', 'crate', NULL);

-- ----------------------------------------
-- CRATE BACKGROUNDS
-- ----------------------------------------
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Lava Flow', 'background', 'common', 'Hot molten vibes', 'bg-lava', 'crate', NULL),
    ('Deep Ocean', 'background', 'uncommon', 'Calm deep blue', 'bg-ocean', 'crate', NULL),
    ('Galaxy Swirl', 'background', 'rare', 'Spinning galaxy arms', 'bg-galaxy', 'crate', NULL),
    ('Rainbow Pulse', 'background', 'epic', 'Shifting rainbow colors', 'bg-rainbow', 'crate', NULL),
    ('Inferno', 'background', 'legendary', 'Blazing hellfire', 'bg-inferno', 'crate', NULL);

-- ----------------------------------------
-- CRATE CARD STYLES
-- ----------------------------------------
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Smooth Slate', 'card_style', 'common', 'Clean slate look', 'card-slate', 'crate', NULL),
    ('Bronze Edge', 'card_style', 'uncommon', 'Warm bronze border', 'card-bronze', 'crate', NULL),
    ('Crystal Ice', 'card_style', 'rare', 'Frozen crystal frame', 'card-crystal', 'crate', NULL),
    ('Plasma Border', 'card_style', 'epic', 'Electric plasma edge', 'card-plasma', 'crate', NULL),
    ('Dragon Scale', 'card_style', 'legendary', 'Scaled dragon armor', 'card-dragon', 'crate', NULL);
