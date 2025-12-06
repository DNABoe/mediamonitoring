# Product Requirements Document (PRD)
## Fighter Jet Procurement Intelligence Platform

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Production

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [User Personas](#user-personas)
4. [Core Features](#core-features)
5. [Technical Architecture](#technical-architecture)
6. [Data Models](#data-models)
7. [Design System](#design-system)
8. [Security & Compliance](#security--compliance)
9. [Edge Functions](#edge-functions)
10. [Analytics & Metrics](#analytics--metrics)

---

## Executive Summary

The Fighter Jet Procurement Intelligence Platform is a comprehensive media monitoring and competitive intelligence system designed for defense industry stakeholders tracking fighter jet procurement programs worldwide. The platform aggregates, analyzes, and visualizes data from news media, social platforms, and political sources to provide actionable insights on procurement decisions.

### Key Value Propositions

- **Real-time Media Monitoring**: Automated collection and analysis of news articles related to fighter procurement
- **Competitive Intelligence**: Multi-dimensional analysis comparing Gripen against competitors (F-35, Eurofighter, Rafale, etc.)
- **Sentiment Analysis**: AI-powered sentiment tracking across media and social platforms
- **Strategic Recommendations**: AI-generated strategic suggestions based on collected intelligence
- **Political Heat Mapping**: Visualization of political stakeholder positions

---

## Product Overview

### Problem Statement

Defense industry stakeholders need comprehensive, real-time intelligence on fighter jet procurement programs across multiple countries. Manual monitoring of media, social platforms, and political developments is time-consuming and prone to missing critical signals.

### Solution

An AI-powered intelligence platform that:
- Automatically discovers and monitors relevant media outlets
- Collects and translates articles from multiple languages
- Analyzes sentiment and relevance using AI
- Tracks social media discussions across platforms
- Generates strategic recommendations
- Provides comparative analysis across competitors

### Target Markets

- **Primary**: Saab (Gripen manufacturer) business development teams
- **Secondary**: Defense industry analysts, government procurement offices

---

## User Personas

### Primary User: Business Development Manager

**Role**: Tracks procurement opportunities and competitive landscape  
**Goals**:
- Monitor media coverage in target countries
- Understand competitor positioning
- Identify political support/opposition
- Prepare briefings for leadership

**Pain Points**:
- Information scattered across multiple sources
- Language barriers with local media
- Difficulty quantifying sentiment trends
- Time-consuming manual research

### Secondary User: Strategic Analyst

**Role**: Provides deep analysis on procurement programs  
**Goals**:
- Generate comprehensive country reports
- Track historical trends
- Identify emerging narratives
- Assess industrial cooperation opportunities

---

## Core Features

### 1. Media Monitoring Agent

**Description**: Autonomous AI agent that discovers outlets, collects articles, and performs analysis.

**Capabilities**:
- Automatic outlet discovery for target countries
- Article collection with configurable frequency
- AI-powered relevance scoring (minimum threshold: 6/10)
- Automatic translation to English
- Fighter jet tagging and categorization

**Status Indicators**:
- Agent status (idle/running/discovering/collecting/analyzing)
- Last run timestamp
- Next scheduled run
- Articles collected count
- Outlets monitored count

### 2. Article Analysis

**For each article**:
- Sentiment score (-1 to +1)
- Importance score (1-10)
- Fighter tags (competitors mentioned)
- Key points extraction
- Narrative theme identification
- Article tone classification
- Influence score

**Filtering Capabilities**:
- By date range
- By fighter/competitor
- By sentiment (positive/neutral/negative)
- By source outlet
- By importance score

### 3. Sentiment Dashboard

**Visualizations**:
- Sentiment over time (line chart)
- Sentiment distribution (pie/bar chart)
- Publication timeline
- Hotness meter (momentum indicator)

**Key Metrics**:
- Average sentiment by fighter
- Mention volume trends
- Sentiment momentum
- Media reach score

### 4. Social Media Analysis

**Platforms Monitored**:
- Reddit
- X (Twitter)
- Facebook
- LinkedIn

**Analysis Includes**:
- Post sentiment scoring
- Fighter tagging
- Engagement metrics
- Author influence assessment
- Discussion temperature

**Coverage**: Minimum 6 months historical data

### 5. Background Analysis

**Sections**:
- Procurement Context
- Political Context
- Geopolitical Factors
- Economic Factors
- Historical Patterns
- Industry Cooperation Opportunities
- Gripen Overview
- Competitor Overview

**Change Tracking**: Comparison with previous analysis highlighting key changes

### 6. Strategic Suggestions

**AI-Generated Recommendations**:
- Messaging strategies
- Stakeholder engagement priorities
- Counter-narrative approaches
- Industrial partnership opportunities
- Timeline considerations

### 7. Competitive Analysis (Chance to Win)

**Dimensions Analyzed**:
- Media Sentiment
- Political Support
- Industrial Cooperation
- Cost Competitiveness
- Technical Capabilities

**Features**:
- Thermometer visualization (0-10 scale)
- Adjustable dimension weights
- AI-suggested weights with rationale
- Real-time score updates

### 8. Black Hat Analysis

**Purpose**: Identify potential competitor attack vectors and prepare defensive strategies

### 9. Politics Heat Map

**Visualization**: Interactive map showing political stakeholder positions on procurement

### 10. Baseline Management

**Capabilities**:
- Set tracking period start/end dates
- Generate baseline snapshots
- Compare current state to baseline
- Track metric changes over time

---

## Technical Architecture

### Frontend Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| Tailwind CSS | Styling |
| shadcn/ui | Component Library |
| React Query | Data Fetching |
| Recharts | Data Visualization |
| React Router | Navigation |
| Framer Motion | Animations |

### Backend Stack (Lovable Cloud / Supabase)

| Technology | Purpose |
|------------|---------|
| PostgreSQL | Database |
| Edge Functions | Serverless Logic |
| Row Level Security | Data Protection |
| Realtime | Live Updates |
| Storage | File Management |

### External Integrations

| Service | Purpose |
|---------|---------|
| Perplexity AI | Article search & analysis |
| OpenAI/Gemini | Content analysis (via Lovable AI) |
| Google Search API | Article discovery |

---

## Data Models

### Core Tables

#### `items` (Articles)
```
id: UUID (PK)
user_id: UUID (FK)
url: TEXT
title_en: TEXT
title_pt: TEXT (original language)
fulltext_en: TEXT
fulltext_pt: TEXT
summary_en: TEXT
published_at: TIMESTAMP
fetched_at: TIMESTAMP
source_id: UUID (FK -> sources)
source_country: TEXT
tracking_country: TEXT
sentiment: FLOAT (-1 to 1)
fighter_tags: TEXT[]
politics_tags: TEXT[]
entities: JSON
engagement: JSON
stance: JSON
```

#### `article_analyses`
```
id: UUID (PK)
article_id: UUID (FK -> items)
user_id: UUID
main_sentiment: JSON
sentiment_details: JSON
key_points: TEXT[]
narrative_themes: TEXT[]
article_tone: TEXT
influence_score: INTEGER
extracted_quotes: JSON
```

#### `social_media_posts`
```
id: UUID (PK)
user_id: UUID
platform: TEXT (reddit/twitter/facebook/linkedin)
post_id: TEXT
post_url: TEXT
content: TEXT
author_name: TEXT
author_username: TEXT
published_at: TIMESTAMP
sentiment: FLOAT
fighter_tags: TEXT[]
engagement_metrics: JSON
tracking_country: TEXT
```

#### `sources` (Media Outlets)
```
id: UUID (PK)
name: TEXT
url: TEXT
type: TEXT
country: TEXT
credibility_tier: INTEGER
enabled: BOOLEAN
```

#### `agent_status`
```
id: UUID (PK)
user_id: UUID
status: TEXT
active_country: TEXT
active_competitors: TEXT[]
update_frequency: TEXT
last_run_at: TIMESTAMP
next_run_at: TIMESTAMP
outlets_discovered: INTEGER
articles_collected_total: INTEGER
last_error: TEXT
```

#### `background_analysis`
```
id: UUID (PK)
user_id: UUID
country: TEXT
competitors: TEXT[]
procurement_context: TEXT
political_context: TEXT
geopolitical_factors: TEXT
economic_factors: TEXT
historical_patterns: TEXT
industry_cooperation: TEXT
gripen_overview: TEXT
competitor_overview: TEXT
```

#### `user_settings`
```
id: UUID (PK)
user_id: UUID
active_country: TEXT
active_competitors: TEXT[]
auto_refresh_enabled: BOOLEAN
prioritized_outlets: JSON
social_media_platforms: JSON
```

#### `baselines`
```
id: UUID (PK)
created_by: UUID
tracking_country: TEXT
start_date: DATE
end_date: DATE
items_count: INTEGER
alerts_count: INTEGER
metrics_summary: JSON
data: JSON
status: TEXT
```

#### `comparison_metrics`
```
id: UUID (PK)
user_id: UUID
country: TEXT
fighter: TEXT
metric_date: DATE
sentiment_score: FLOAT
mentions_count: INTEGER
media_reach_score: INTEGER
political_support_score: INTEGER
dimension_scores: JSON
```

---

## Design System

### Brand Identity

**Primary Brand**: Saab Defense  
**Visual Language**: Professional, technical, authoritative

### Color Palette

All colors defined in HSL format for consistency.

#### Core Colors

| Token | HSL Value | Hex Equivalent | Usage |
|-------|-----------|----------------|-------|
| `--background` | 24 5% 21% | #373532 | Main background |
| `--foreground` | 60 2% 95% | #F2F2F0 | Primary text |
| `--card` | 24 2% 37% | #5E5C58 | Card backgrounds |
| `--primary` | 45 100% 49% | #FAB900 | CTAs, highlights (Saab Yellow) |
| `--accent` | 210 100% 30% | #004C97 | Secondary actions (Saab Blue) |
| `--destructive` | 4 77% 48% | #DA291C | Errors, negative (Saab Red) |
| `--success` | 142 64% 39% | #24A148 | Success, positive (Saab Green) |
| `--warning` | 54 100% 50% | #FFE100 | Warnings |
| `--caution` | 24 100% 50% | #FF6700 | Caution (Saab Orange) |
| `--muted` | 20 2% 52% | #878582 | Muted elements |
| `--border` | 20 2% 37% | #5E5C58 | Borders |

#### Semantic Usage

- **Primary (Yellow)**: Main CTAs, important highlights, Gripen-related elements
- **Accent (Blue)**: Secondary actions, links, informational elements
- **Success (Green)**: Positive sentiment, successful operations, growth indicators
- **Destructive (Red)**: Negative sentiment, errors, decline indicators
- **Caution (Orange)**: Warnings, attention-required items
- **Muted (Grey)**: Secondary text, disabled states, subtle backgrounds

### Typography

**Font Family**: 'Aktiv Grotesk', Arial, sans-serif  
**Letter Spacing**: -0.01em (slightly tighter)

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 2.25rem | 700 | 1.2 |
| H2 | 1.875rem | 600 | 1.25 |
| H3 | 1.5rem | 600 | 1.3 |
| H4 | 1.25rem | 500 | 1.4 |
| Body | 1rem | 400 | 1.5 |
| Small | 0.875rem | 400 | 1.5 |
| Caption | 0.75rem | 400 | 1.4 |

### Spacing System

Based on 4px grid:

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 64px |

### Border Radius

`--radius: 0.25rem` (4px) - Minimal, technical aesthetic

### Shadows & Effects

```css
--glow-primary: 0 0 20px hsl(45 100% 49% / 0.5);
--glow-success: 0 0 20px hsl(142 64% 39% / 0.5);
--glow-danger: 0 0 20px hsl(4 77% 48% / 0.5);
--glow-accent: 0 0 20px hsl(210 100% 30% / 0.5);
```

### Gradients

```css
--gradient-primary: linear-gradient(135deg, hsl(45, 100%, 49%), hsl(45, 100%, 60%));
--gradient-success: linear-gradient(135deg, hsl(142, 64%, 39%), hsl(142, 64%, 50%));
--gradient-danger: linear-gradient(135deg, hsl(4, 77%, 48%), hsl(4, 77%, 58%));
--gradient-accent: linear-gradient(135deg, hsl(210, 100%, 30%), hsl(210, 100%, 40%));
```

### Component Variants

#### Buttons

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| Primary | `--primary` | `--primary-foreground` | none |
| Secondary | `--secondary` | `--secondary-foreground` | none |
| Destructive | `--destructive` | `--destructive-foreground` | none |
| Outline | transparent | `--foreground` | `--border` |
| Ghost | transparent | `--foreground` | none |

#### Cards

- Background: `--card`
- Border: `--border` (1px)
- Radius: `--radius`
- Padding: 16px (md)

#### Inputs

- Background: `--input`
- Border: `--border` (1px)
- Focus ring: `--ring` (primary)
- Radius: `--radius`

### Chart Colors

```css
--chart-1: 45 100% 49%;   /* Primary Yellow */
--chart-2: 210 100% 30%;  /* Accent Blue */
--chart-3: 142 64% 39%;   /* Success Green */
--chart-4: 4 77% 48%;     /* Destructive Red */
--chart-5: 24 100% 50%;   /* Caution Orange */
```

### Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablets |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |
| 2xl | 1536px | Extra large |

### Mobile Considerations

- Tab layouts: 2-3 columns instead of 4
- Abbreviated text labels
- Compact headers
- Collapsible filters (hidden by default)
- Touch-friendly form controls (minimum 44px tap targets)

---

## Security & Compliance

### Authentication

- Email/password authentication
- Auto-confirm enabled for development
- Session-based with JWT tokens
- Role-based access (admin/user)

### Row Level Security (RLS)

All tables implement RLS policies:
- Users can only access their own data
- Data filtered by `user_id` column
- Admin role has elevated permissions

### Data Encryption

Sensitive data encrypted using AES-256-GCM:
- Research reports
- Background analysis
- Article content
- Social media posts

### Audit Logging

`admin_audit_log` table tracks:
- Admin actions
- User management changes
- Configuration modifications

---

## Edge Functions

### Article Collection

**`collect-articles-for-tracking`**
- Searches for articles using Perplexity AI
- Filters by relevance score (≥6)
- Maximum 40 articles per collection
- Translates non-English titles
- Tags fighters and extracts entities

### Social Media Collection

**`collect-social-media`**
- Queries Reddit, X, Facebook, LinkedIn
- 6-month historical coverage
- Sentiment analysis per post
- Fighter tagging
- Relevance filtering (≥7)

### Analysis Functions

**`analyze-article`**
- Deep sentiment analysis
- Key point extraction
- Narrative theme identification
- Quote extraction

**`analyze-sentiment`**
- Batch sentiment processing
- Fighter-specific sentiment breakdown

**`generate-background-analysis`**
- Comprehensive country analysis
- Political/economic context
- Historical patterns

**`generate-strategic-suggestions`**
- AI-generated recommendations
- Based on current intelligence

**`research-fighter-comparison`**
- Multi-dimensional scoring
- Competitive analysis
- Perplexity-powered research

**`generate-blackhat-analysis`**
- Competitor attack vector analysis
- Defensive strategy recommendations

### Agent Functions

**`agent-monitor-news`**
- Orchestrates monitoring cycle
- Triggers collection and analysis

**`agent-discover-outlets`**
- Finds relevant media outlets
- Country-specific discovery

**`trigger-agent-run`**
- Manual agent trigger
- Configurable run type

### Utility Functions

**`translate-existing-articles`**
- Batch translation of articles
- Original language preservation

**`reset-research-data`**
- Data cleanup utility
- Country-specific reset

---

## Analytics & Metrics

### Key Performance Indicators

| Metric | Description | Target |
|--------|-------------|--------|
| Article Relevance | % of articles scoring ≥6 | >70% |
| Collection Coverage | Articles captured vs available | >80% |
| Sentiment Accuracy | Manual validation score | >85% |
| Translation Quality | Human review score | >90% |
| Agent Uptime | Successful runs / total runs | >99% |

### Dashboard Metrics

- Total articles collected
- Average sentiment by fighter
- Mention velocity (articles/day)
- Social engagement rate
- Political sentiment distribution

### Trend Calculations

- Requires full tracking period data
- Baseline comparison enabled
- Rolling averages supported
- Momentum indicators

---

## Appendix

### Competitor Reference

| Fighter | Manufacturer | Country |
|---------|--------------|---------|
| Gripen E/F | Saab | Sweden |
| F-35 | Lockheed Martin | USA |
| Eurofighter Typhoon | Airbus/BAE/Leonardo | EU |
| Rafale | Dassault | France |
| F/A-18 Super Hornet | Boeing | USA |
| F-16 | Lockheed Martin | USA |

### Country Codes

Standard ISO 3166-1 alpha-2 codes used:
- PT: Portugal
- AT: Austria
- CH: Switzerland
- BE: Belgium
- etc.

### Glossary

- **RLS**: Row Level Security - Database-level access control
- **Edge Function**: Serverless backend function
- **Sentiment Score**: -1 (negative) to +1 (positive)
- **Importance Score**: 1-10 relevance rating
- **Hotness**: Trending/momentum indicator
- **Baseline**: Reference snapshot for comparison

---

*Document maintained by Lovable AI. Last generated: December 2024*
