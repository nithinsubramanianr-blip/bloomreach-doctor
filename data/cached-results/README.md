# Cached Discovery Results

Pre-populated cache files for Module B (ShopperSimulator) and M5 (Next.js PLP).

## Purpose
- Primary: result caching layer (keyed by persona_id + state, 300s TTL)
- Fallback: if Discovery latency > 2 seconds, serve from these files
- Emergency fallback: if Discovery is unreachable, these files ensure demo never shows empty grid

## Files

| File | Persona | State | Query |
|---|---|---|---|
| guest-before.json | Guest (New Prospecting) | Before (rules inactive) | necklace |
| guest-after.json | Guest (New Prospecting) | After (rules active) | necklace |
| sarah-before.json | Sarah (Gifting) | Before (rules inactive) | necklace |
| sarah-after.json | Sarah (Gifting) | After (rules active) | necklace |
| alex-before.json | Alex (High Value Returning) | Before (rules inactive) | necklace |
| alex-after.json | Alex (High Value Returning) | After (rules active) | necklace |

## Format
Each file matches the Discovery search API response shape after normalisation.
Populate these files by running real Discovery API calls once sandbox is available.
