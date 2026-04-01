-- ============================================================
-- BullRun — Extended Content: Battle Pass to Lv250 + More Stocks
-- ============================================================
-- Adds ~45 new battle pass items spread across levels 21-250
-- Adds 35 new stocks (17 real companies + 18 fictional)
-- ============================================================

-- ============================================================
-- BATTLE PASS TITLES (Levels 21-250)
-- ============================================================
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Profit Machine', 'title', 'uncommon', 'Printing money', 'title-profitmachine', 'battlepass', 22),
    ('Bearslayer', 'title', 'uncommon', 'Bears fear this trader', 'title-bearslayer', 'battlepass', 28),
    ('Chart Wizard', 'title', 'rare', 'Reads candles like a book', 'title-chartwizard', 'battlepass', 35),
    ('Floor Trader', 'title', 'rare', 'Old school hustler', 'title-floortrader', 'battlepass', 42),
    ('Dividend King', 'title', 'rare', 'Passive income royalty', 'title-dividendking', 'battlepass', 50),
    ('Options Dealer', 'title', 'epic', 'Leveraged to the max', 'title-optionsdealer', 'battlepass', 60),
    ('Insider Trader', 'title', 'epic', 'Knows things others dont', 'title-insidertrader', 'battlepass', 75),
    ('Market Maker', 'title', 'epic', 'Sets the prices', 'title-marketmaker', 'battlepass', 90),
    ('Billionaire', 'title', 'epic', 'Three comma club', 'title-billionaire', 'battlepass', 110),
    ('Hedge Lord', 'title', 'legendary', 'Master of all strategies', 'title-hedgelord', 'battlepass', 130),
    ('Wall Street Elite', 'title', 'legendary', 'Top 1% of the top 1%', 'title-wallstreet', 'battlepass', 160),
    ('Goldman Sacker', 'title', 'legendary', 'Big bank energy', 'title-goldman', 'battlepass', 190),
    ('Federal Reserve', 'title', 'legendary', 'Controls the money printer', 'title-fedreserve', 'battlepass', 220),
    ('GOAT Trader', 'title', 'legendary', 'Greatest of all time', 'title-goat', 'battlepass', 250);

-- ============================================================
-- BATTLE PASS BACKGROUNDS (Levels 21-250)
-- ============================================================
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Emerald Glow', 'background', 'uncommon', 'Rich emerald tones', 'bg-emerald', 'battlepass', 25),
    ('Sunset Fade', 'background', 'uncommon', 'Warm orange to purple', 'bg-sunset', 'battlepass', 32),
    ('Electric Storm', 'background', 'rare', 'Crackling energy', 'bg-storm', 'battlepass', 40),
    ('Cyberpunk City', 'background', 'rare', 'Neon cityscape vibes', 'bg-cyberpunk', 'battlepass', 48),
    ('Arctic Frost', 'background', 'rare', 'Icy cold blue', 'bg-frost', 'battlepass', 58),
    ('Blood Moon', 'background', 'epic', 'Deep crimson sky', 'bg-bloodmoon', 'battlepass', 70),
    ('Holographic', 'background', 'epic', 'Shifting rainbow hologram', 'bg-holographic', 'battlepass', 85),
    ('Dark Matter', 'background', 'epic', 'Void of deep space', 'bg-darkmatter', 'battlepass', 100),
    ('Supernova', 'background', 'legendary', 'Exploding star', 'bg-supernova', 'battlepass', 120),
    ('Black Gold', 'background', 'legendary', 'Oil baron luxury', 'bg-blackgold', 'battlepass', 150),
    ('Quantum Field', 'background', 'legendary', 'Reality bending patterns', 'bg-quantum', 'battlepass', 180),
    ('Diamond Vault', 'background', 'legendary', 'Sparkling treasure room', 'bg-diamondvault', 'battlepass', 210),
    ('Prestige Gold', 'background', 'legendary', 'Ultimate golden prestige', 'bg-prestigegold', 'battlepass', 245);

-- ============================================================
-- BATTLE PASS CARD STYLES (Levels 21-250)
-- ============================================================
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Emerald Frame', 'card_style', 'uncommon', 'Green gem border', 'card-emerald', 'battlepass', 30),
    ('Copper Wire', 'card_style', 'rare', 'Industrial copper look', 'card-copper', 'battlepass', 45),
    ('Ruby Edge', 'card_style', 'rare', 'Deep red gem border', 'card-ruby', 'battlepass', 55),
    ('Sapphire Glow', 'card_style', 'epic', 'Blue gem radiance', 'card-sapphire', 'battlepass', 65),
    ('Titanium Plate', 'card_style', 'epic', 'Heavy duty metal frame', 'card-titanium', 'battlepass', 80),
    ('Obsidian Edge', 'card_style', 'epic', 'Dark volcanic glass', 'card-obsidian', 'battlepass', 95),
    ('Platinum Shine', 'card_style', 'legendary', 'Pure platinum border', 'card-platinum', 'battlepass', 115),
    ('Aurora Frame', 'card_style', 'legendary', 'Northern lights border', 'card-auroraframe', 'battlepass', 140),
    ('Void Fracture', 'card_style', 'legendary', 'Reality-cracking border', 'card-void', 'battlepass', 170),
    ('Celestial Crown', 'card_style', 'legendary', 'Heavenly golden frame', 'card-celestial', 'battlepass', 200),
    ('Prestige Diamond', 'card_style', 'legendary', 'The ultimate card style', 'card-prestigediamond', 'battlepass', 240);

-- ============================================================
-- MORE CRATE ITEMS (bonus variety for spins)
-- ============================================================
INSERT OR IGNORE INTO cosmetics (name, type, rarity, description, css_value, source, battlepass_level) VALUES
    ('Bag Holder', 'title', 'common', 'Still holding...', 'title-bagholder', 'crate', NULL),
    ('Short Seller', 'title', 'uncommon', 'Bets against the market', 'title-shortseller', 'crate', NULL),
    ('Pump & Dump', 'title', 'rare', 'Buy the rumour sell the news', 'title-pumpdump', 'crate', NULL),
    ('Dark Pool', 'title', 'epic', 'Trades in the shadows', 'title-darkpool', 'crate', NULL),
    ('Toxic Waste', 'background', 'uncommon', 'Glowing green sludge', 'bg-toxic', 'crate', NULL),
    ('Magma Core', 'background', 'rare', 'Molten earth core', 'bg-magma', 'crate', NULL),
    ('Nebula Swirl', 'background', 'epic', 'Cosmic cloud formation', 'bg-nebula', 'crate', NULL),
    ('Rust Edge', 'card_style', 'common', 'Weathered metal frame', 'card-rust', 'crate', NULL),
    ('Emerald Crate', 'card_style', 'rare', 'Lucky green frame', 'card-emeraldcrate', 'crate', NULL),
    ('Phantom Border', 'card_style', 'legendary', 'Ghostly fading edge', 'card-phantom', 'crate', NULL);

-- ============================================================
-- NEW STOCKS — Real Companies (17 more)
-- ============================================================
INSERT OR IGNORE INTO stocks (symbol, name, sector, current_price, previous_price, base_price, volatility) VALUES
    ('AMD', 'Advanced Micro Devices', 'Technology', 165.00, 165.00, 165.00, 0.032),
    ('INTC', 'Intel Corporation', 'Technology', 32.00, 32.00, 32.00, 0.025),
    ('CRM', 'Salesforce Inc.', 'Technology', 290.00, 290.00, 290.00, 0.020),
    ('PYPL', 'PayPal Holdings', 'Finance', 68.00, 68.00, 68.00, 0.028),
    ('SQ', 'Block Inc.', 'Finance', 82.00, 82.00, 82.00, 0.035),
    ('SHOP', 'Shopify Inc.', 'E-Commerce', 78.00, 78.00, 78.00, 0.038),
    ('BA', 'Boeing Company', 'Aerospace', 178.00, 178.00, 178.00, 0.022),
    ('JPM', 'JPMorgan Chase', 'Finance', 198.00, 198.00, 198.00, 0.014),
    ('V', 'Visa Inc.', 'Finance', 280.00, 280.00, 280.00, 0.012),
    ('WMT', 'Walmart Inc.', 'Retail', 165.00, 165.00, 165.00, 0.010),
    ('KO', 'Coca-Cola Company', 'Consumer', 62.00, 62.00, 62.00, 0.008),
    ('PEP', 'PepsiCo Inc.', 'Consumer', 172.00, 172.00, 172.00, 0.010),
    ('PFE', 'Pfizer Inc.', 'Healthcare', 28.00, 28.00, 28.00, 0.022),
    ('XOM', 'Exxon Mobil Corp.', 'Energy', 112.00, 112.00, 112.00, 0.018),
    ('COST', 'Costco Wholesale', 'Retail', 740.00, 740.00, 740.00, 0.012),
    ('SBUX', 'Starbucks Corp.', 'Consumer', 98.00, 98.00, 98.00, 0.016),
    ('T', 'AT&T Inc.', 'Telecom', 18.50, 18.50, 18.50, 0.015);

-- ============================================================
-- NEW STOCKS — Fictional Companies (18 more)
-- ============================================================
INSERT OR IGNORE INTO stocks (symbol, name, sector, current_price, previous_price, base_price, volatility) VALUES
    ('ZEPH', 'Zephyr Aerospace', 'Aerospace', 185.00, 185.00, 185.00, 0.030),
    ('BLZE', 'BlazeNet Telecom', 'Telecom', 42.00, 42.00, 42.00, 0.028),
    ('VRTX', 'Vertex Quantum', 'Technology', 520.00, 520.00, 520.00, 0.045),
    ('CRAG', 'Cragstone Mining', 'Mining', 38.00, 38.00, 38.00, 0.025),
    ('PHNX', 'Phoenix Renewables', 'Energy', 95.00, 95.00, 95.00, 0.022),
    ('TIDE', 'TideBreaker Marine', 'Logistics', 67.00, 67.00, 67.00, 0.020),
    ('FANG', 'FangByte Security', 'Cybersecurity', 210.00, 210.00, 210.00, 0.032),
    ('ECHO', 'EchoVerse Studios', 'Gaming', 28.00, 28.00, 28.00, 0.042),
    ('SILK', 'SilkRoute Trade', 'E-Commerce', 156.00, 156.00, 156.00, 0.018),
    ('ATOM', 'Atomix Nuclear', 'Energy', 88.00, 88.00, 88.00, 0.030),
    ('CLAD', 'CloudClad Systems', 'Technology', 134.00, 134.00, 134.00, 0.026),
    ('WRTH', 'Warthstone Finance', 'Finance', 72.00, 72.00, 72.00, 0.016),
    ('SKAR', 'Skarlett Biotech', 'Biotech', 345.00, 345.00, 345.00, 0.040),
    ('LOOM', 'Loomcraft Fashion', 'Fashion', 22.00, 22.00, 22.00, 0.035),
    ('VULT', 'Vulture Capital', 'Finance', 190.00, 190.00, 190.00, 0.024),
    ('RUNE', 'RuneForge Digital', 'Technology', 58.00, 58.00, 58.00, 0.038),
    ('ZENX', 'ZenithX Space', 'Space', 280.00, 280.00, 280.00, 0.048),
    ('TUSK', 'TuskGuard Defense', 'Defense', 145.00, 145.00, 145.00, 0.018);
