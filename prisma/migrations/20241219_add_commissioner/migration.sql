-- Add commissioner_id column to leagues table
ALTER TABLE "leagues" ADD COLUMN "commissioner_id" TEXT;

-- Create index on commissioner_id
CREATE INDEX "leagues_commissioner_id_idx" ON "leagues"("commissioner_id");

-- Add foreign key constraint to users table
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_commissioner_id_fkey" FOREIGN KEY ("commissioner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
