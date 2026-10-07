ALTER TABLE deals ALTER COLUMN currency SET DEFAULT 'INR';
UPDATE deals SET currency = 'INR' WHERE currency = 'USD';
