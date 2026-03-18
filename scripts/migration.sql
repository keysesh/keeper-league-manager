-- Migration SQL: Fix 51 keeper base_cost records
-- Generated from PlayerAcquisition table (source of truth)
BEGIN;

-- Amon-Ra St. Brown (2024): R11 → R13 (origR=13, 1yr)
UPDATE keepers SET base_cost = 13 WHERE id = 'cmkjdxhp4018bxqrh3a49ydgy';
-- Anthony Richardson (2024): R10 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkjdwzlw016pxqrhrtu4lmje';
-- Baltimore Ravens (2024): R13 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkjdxk7p018jxqrhxhmvugnn';
-- Bijan Robinson (2024): R2 → R1 (origR=1, 1yr)
UPDATE keepers SET base_cost = 1 WHERE id = 'cmkjdx90w017hxqrhtb12gq59';
-- Calvin Ridley (2025): R13 → R16 (origR=16, 1yr)
UPDATE keepers SET base_cost = 16 WHERE id = 'cmjuilq3e0069yycc0ht996qr';
-- Chase Brown (2026): R7 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmklhhh8h0001r8lyao5qoeu6';
-- Colston Loveland (2026): R7 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkmwthe700019pml1mkrnnka';
-- Cooper Kupp (2024): R3 → R4 (origR=5, 2yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmkjdxd43017vxqrhqsa91ntk';
-- Dallas Goedert (2023): R6 → R5 (origR=5, 1yr)
UPDATE keepers SET base_cost = 5 WHERE id = 'cmjuil9pj001tyycc0m4e1tpi';
-- Dalvin Cook (2023): R5 → R2 (origR=2, 1yr)
UPDATE keepers SET base_cost = 2 WHERE id = 'cmjuil86h001dyyccvqijqklr';
-- DeAndre Hopkins (2024): R2 → R3 (origR=4, 2yr)
UPDATE keepers SET base_cost = 3 WHERE id = 'cmkjdxa83017lxqrh59i17k5o';
-- De'Von Achane (2024): R11 → R12 (origR=12, 1yr)
UPDATE keepers SET base_cost = 12 WHERE id = 'cmkjdxh550189xqrhpvqexazv';
-- DK Metcalf (2024): R8 → R9 (origR=10, 2yr)
UPDATE keepers SET base_cost = 9 WHERE id = 'cmkjdx4t40173xqrhg9evx90e';
-- Ezekiel Elliott (2024): R11 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkjdx5et0175xqrhixzxyz8f';
-- Garrett Wilson (2024): R5 → R6 (origR=7, 2yr)
UPDATE keepers SET base_cost = 6 WHERE id = 'cmkjdx0vr016txqrhehn3s8wf';
-- George Kittle (2023): R4 → R3 (origR=3, 1yr)
UPDATE keepers SET base_cost = 3 WHERE id = 'cmjuil4jn000byyccrm5lhhx3';
-- George Pickens (2024): R4 → R5 (origR=6, 2yr)
UPDATE keepers SET base_cost = 5 WHERE id = 'cmkjdxe76017zxqrh6p6kt28d';
-- George Pickens (2025): R2 → R4 (origR=6, 3yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmkmwf6we0001a16vfvpxh4rq';
-- George Pickens (2026): R1 → R3 (origR=6, 4yr)
UPDATE keepers SET base_cost = 3 WHERE id = 'cmkmadx2p0007i7famxjs93nv';
-- Isiah Pacheco (2024): R6 → R7 (origR=7, 1yr)
UPDATE keepers SET base_cost = 7 WHERE id = 'cmkjdxfc50183xqrh7qaigwqw';
-- Jahan Dotson (2023): R14 → R13 (origR=13, 1yr)
UPDATE keepers SET base_cost = 13 WHERE id = 'cmjuiledl0035yycco39t1ifn';
-- Jahmyr Gibbs (2026): R2 → R1 (origR=2, 2yr)
UPDATE keepers SET base_cost = 1 WHERE id = 'cmkmtcpy70003yzfsa5htz9rb';
-- Jake Ferguson (2024): R15 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkjdx66t0177xqrha5iiqbqb';
-- James Conner (2024): R3 → R4 (origR=4, 1yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmkjdxbfc017pxqrhd6spf0pl';
-- Javonte Williams (2026): R10 → R4 (origR=4, 1yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmkmadrf30003i7faejf2mdpa';
-- Joe Mixon (2024): R1 → R4 (origR=4, 1yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmkjdx9oq017jxqrhw10e1g98';
-- Jonathan Taylor (2024): R5 → R4 (origR=5, 2yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmkjdx4560171xqrhkmaw0vr2';
-- Justin Jefferson (2024): R7 → R9 (origR=9, 1yr)
UPDATE keepers SET base_cost = 9 WHERE id = 'cmkjdxgje0187xqrhmdqkv1n1';
-- Kenneth Walker (2023): R8 → R3 (origR=3, 1yr)
UPDATE keepers SET base_cost = 3 WHERE id = 'cmjuilc0g002hyyccwqq4nimm';
-- Khalil Shakir (2025): R8 → R10 (origR=10, 1yr)
UPDATE keepers SET base_cost = 10 WHERE id = 'cmjuilpgn0063yyccebowmqf3';
-- Lamar Jackson (2024): R1 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmklhlmm80001m4m63oitbw9m';
-- Lamar Jackson (2024): R1 → R2 (origR=2, 1yr)
UPDATE keepers SET base_cost = 2 WHERE id = 'cmkjdx7vg017dxqrhyxf5pc6f';
-- Mark Andrews (2026): R7 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkmae21h000bi7farxcmzy1v';
-- Marvin Harrison (2026): R4 → R1 (origR=1, 1yr)
UPDATE keepers SET base_cost = 1 WHERE id = 'cmkmae4e7000di7fa1h498rqb';
-- Mike Evans (2024): R1 → R2 (origR=3, 2yr)
UPDATE keepers SET base_cost = 2 WHERE id = 'cmkm9yiny01wqri289u0dx6px';
-- Mike Evans (2024): R1 → R2 (origR=3, 2yr)
UPDATE keepers SET base_cost = 2 WHERE id = 'cmkjdx8h6017fxqrh4b25708w';
-- Miles Sanders (2023): R5 → R4 (origR=4, 1yr)
UPDATE keepers SET base_cost = 4 WHERE id = 'cmjuil7f50015yycc995xm5g6';
-- Patrick Mahomes (2023): R2 → R1 (origR=1, 1yr)
UPDATE keepers SET base_cost = 1 WHERE id = 'cmjuil69s000tyycc3rfl3iuq';
-- Quinshon Judkins (2026): R7 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmklhhtu90003r8ly5h8s5ikt';
-- Rachaad White (2024): R4 → R5 (origR=5, 1yr)
UPDATE keepers SET base_cost = 5 WHERE id = 'cmkjdxdnk017xxqrh250j8gta';
-- Rashee Rice (2024): R14 → R15 (origR=15, 1yr)
UPDATE keepers SET base_cost = 15 WHERE id = 'cmkjdxiar018dxqrhfmaf8zhj';
-- Saquon Barkley (2023): R5 → R2 (origR=2, 1yr)
UPDATE keepers SET base_cost = 2 WHERE id = 'cmjuil8r4001jyycc0etv7sba';
-- Saquon Barkley (2024): R1 → R2 (origR=2, 1yr)
UPDATE keepers SET base_cost = 2 WHERE id = 'cmkjdx6se0179xqrh9btygc5y';
-- Terry McLaurin (2024): R3 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkjdxc13017rxqrhl3x6c8lj';
-- Travis Etienne (2023): R7 → R6 (origR=6, 1yr)
UPDATE keepers SET base_cost = 6 WHERE id = 'cmjuilb8q0029yyccd1kurfgk';
-- Travis Etienne (2025): R5 → R6 (origR=6, 1yr)
UPDATE keepers SET base_cost = 6 WHERE id = 'cmkm9y60u01wmri28j1sjzj23';
-- Travis Kelce (2024): R2 → R1 (origR=1, 2yr)
UPDATE keepers SET base_cost = 1 WHERE id = 'cmkjdx1nw016vxqrhlcbmiz6c';
-- Trey Benson (2025): R9 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmkm9yaie01wori28mnbg9njm';
-- Tua Tagovailoa (2024): R14 → R15 (origR=15, 1yr)
UPDATE keepers SET base_cost = 15 WHERE id = 'cmkjdxjk0018hxqrhxnop448n';
-- Tyler Higbee (2023): R16 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmjuilfiv003hyycc8j4pcwyp';
-- Tyrone Tracy (2025): R11 → R8 (origR=8, 1yr)
UPDATE keepers SET base_cost = 8 WHERE id = 'cmjuilpub0067yyccmle9b11j';

-- Orphan Lamar Jackson keeper on Jaxon's My Njigba
DELETE FROM keepers WHERE id = 'cmklhlmm80001m4m63oitbw9m';

-- Travis Kelce: original R3 predates synced data
-- Set baseCostOverride on his PlayerAcquisition record
UPDATE player_acquisitions SET base_cost_override = 3
  WHERE player_id = (SELECT id FROM players WHERE full_name = 'Travis Kelce')
    AND owner_sleeper_id = '864935658458877952'
    AND disposition_type IS NULL;

-- COMMIT;  -- Uncomment to apply
ROLLBACK;  -- Safe by default

-- Total: 51 base_cost updates + 1 delete + 1 override
