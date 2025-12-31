-- CreateEnum
CREATE TYPE "TradeProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'CANCELLED', 'VETOED');

-- CreateEnum
CREATE TYPE "TradeProposalPartyStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TradeProposalAssetType" AS ENUM ('PLAYER', 'DRAFT_PICK');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('APPROVE', 'VETO', 'ABSTAIN');

-- CreateTable
CREATE TABLE "trade_proposals" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "proposer_id" TEXT NOT NULL,
    "status" "TradeProposalStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "notes" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "trade_analysis" JSONB,

    CONSTRAINT "trade_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_proposal_parties" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "roster_id" TEXT NOT NULL,
    "status" "TradeProposalPartyStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "trade_proposal_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_proposal_assets" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "from_roster_id" TEXT NOT NULL,
    "to_roster_id" TEXT NOT NULL,
    "asset_type" "TradeProposalAssetType" NOT NULL,
    "player_id" TEXT,
    "pick_season" INTEGER,
    "pick_round" INTEGER,
    "pick_original_owner" TEXT,

    CONSTRAINT "trade_proposal_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_proposal_votes" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "roster_id" TEXT NOT NULL,
    "vote" "VoteType" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_proposal_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trade_proposals_league_id_idx" ON "trade_proposals"("league_id");

-- CreateIndex
CREATE INDEX "trade_proposals_status_idx" ON "trade_proposals"("status");

-- CreateIndex
CREATE INDEX "trade_proposals_proposer_id_idx" ON "trade_proposals"("proposer_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_proposal_parties_proposal_id_roster_id_key" ON "trade_proposal_parties"("proposal_id", "roster_id");

-- CreateIndex
CREATE INDEX "trade_proposal_assets_proposal_id_idx" ON "trade_proposal_assets"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_proposal_votes_proposal_id_roster_id_key" ON "trade_proposal_votes"("proposal_id", "roster_id");

-- AddForeignKey
ALTER TABLE "trade_proposals" ADD CONSTRAINT "trade_proposals_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposals" ADD CONSTRAINT "trade_proposals_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_parties" ADD CONSTRAINT "trade_proposal_parties_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "trade_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_parties" ADD CONSTRAINT "trade_proposal_parties_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_assets" ADD CONSTRAINT "trade_proposal_assets_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "trade_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_assets" ADD CONSTRAINT "trade_proposal_assets_from_roster_id_fkey" FOREIGN KEY ("from_roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_assets" ADD CONSTRAINT "trade_proposal_assets_to_roster_id_fkey" FOREIGN KEY ("to_roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_assets" ADD CONSTRAINT "trade_proposal_assets_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_votes" ADD CONSTRAINT "trade_proposal_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "trade_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_proposal_votes" ADD CONSTRAINT "trade_proposal_votes_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
