-- Create sources table
CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('news', 'government', 'social', 'defense', 'comment')),
  url text NOT NULL,
  credibility_tier integer DEFAULT 1 CHECK (credibility_tier BETWEEN 1 AND 5),
  country text DEFAULT 'PT',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create items table for scraped content
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE,
  fetched_at timestamptz DEFAULT now(),
  published_at timestamptz,
  url text NOT NULL UNIQUE,
  title_pt text,
  title_en text,
  summary_en text,
  fulltext_pt text,
  fulltext_en text,
  fighter_tags text[] DEFAULT '{}',
  politics_tags text[] DEFAULT '{}',
  stance jsonb DEFAULT '{}',
  sentiment float DEFAULT 0,
  entities jsonb DEFAULT '{}',
  engagement jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create scores table
CREATE TABLE scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  fighter text NOT NULL,
  components jsonb DEFAULT '{}',
  hotness float DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create metrics table for aggregated data
CREATE TABLE metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  fighter text NOT NULL,
  mentions integer DEFAULT 0,
  avg_sentiment float DEFAULT 0,
  hotness float DEFAULT 0,
  momentum float DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(day, fighter)
);

-- Create alerts table
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('lockheed_signal', 'us_embassy', 'gov_milestone', 'volume_spike')),
  created_at timestamptz DEFAULT now(),
  matched_text text,
  matched_entities jsonb DEFAULT '{}',
  context_items uuid[],
  status text DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Create settings table
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Insert default keywords
INSERT INTO settings (key, value) VALUES 
('keywords', '["Gripen","JAS 39","F-35","F35","Lockheed Martin","Saab","Força Aérea Portuguesa","FAP","EMFA","EMGFA","Ministério da Defesa","RFI","RFP","offsets","industrial cooperation","transfer of technology","interoperability","NATO","defense budget","procurement","assembly","MRO","training center","jobs","Lisboa","Monte Real","Beja","Alcochete"]'::jsonb);

-- Insert default Portuguese priority weights
INSERT INTO settings (key, value) VALUES 
('priority_weights', '{"sovereignty_control": 0.20, "industrial_participation_jobs": 0.25, "interoperability_NATO_US_EU": 0.20, "cost_of_ownership_budget": 0.20, "schedule_readiness": 0.10, "base_infrastructure_fit": 0.05}'::jsonb);

-- Insert default sources
INSERT INTO sources (name, type, url, credibility_tier, country) VALUES
('RTP', 'news', 'https://www.rtp.pt', 5, 'PT'),
('SIC Notícias', 'news', 'https://sicnoticias.pt', 5, 'PT'),
('Público', 'news', 'https://publico.pt', 5, 'PT'),
('Expresso', 'news', 'https://expresso.pt', 5, 'PT'),
('Observador', 'news', 'https://observador.pt', 4, 'PT'),
('ECO', 'news', 'https://eco.sapo.pt', 4, 'PT'),
('MDN - Defesa', 'government', 'https://defesa.gov.pt', 5, 'PT'),
('EMGFA', 'government', 'https://emgfa.pt', 5, 'PT'),
('Força Aérea', 'government', 'https://emfa.pt', 5, 'PT'),
('Saab Newsroom', 'defense', 'https://saab.com/newsroom', 4, 'INT'),
('Lockheed Martin', 'defense', 'https://lockheedmartin.com', 4, 'US'),
('F-35 Program', 'defense', 'https://f35.com', 4, 'US');

-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (monitoring dashboard is public)
CREATE POLICY "Public read access" ON sources FOR SELECT USING (true);
CREATE POLICY "Public read access" ON items FOR SELECT USING (true);
CREATE POLICY "Public read access" ON scores FOR SELECT USING (true);
CREATE POLICY "Public read access" ON metrics FOR SELECT USING (true);
CREATE POLICY "Public read access" ON alerts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON settings FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX idx_items_published_at ON items(published_at DESC);
CREATE INDEX idx_items_fighter_tags ON items USING GIN(fighter_tags);
CREATE INDEX idx_items_source_id ON items(source_id);
CREATE INDEX idx_scores_fighter ON scores(fighter);
CREATE INDEX idx_metrics_day_fighter ON metrics(day DESC, fighter);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_status ON alerts(status);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE metrics;