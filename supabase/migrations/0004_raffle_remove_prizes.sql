-- Prizes are no longer tracked in the app — the MC announces what's being
-- raffled off verbally, and the software's only job is picking a name in
-- sequence. See context/PRD.md for the decision.

drop table raffle_prizes;

alter table raffle_draws
  drop column prize_key,
  drop column prize_name;

-- raffle_draws_prize_key_idx was defined on prize_key and is dropped
-- automatically with the column — nothing to do for it explicitly.
