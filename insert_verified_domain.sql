-- Insert a pre-verified domain record
-- This will make the domain already verified for the next 30 days
-- Replace 'www.105thdelivery.com' with your actual domain

INSERT INTO `domain_verification` (
  `id`,
  `domain`,
  `last_verified_at`,
  `verification_status`,
  `client_status`,
  `subscription_status`,
  `subscription_end_date`,
  `verified_by`,
  `metadata`,
  `created_at`,
  `updated_at`
) VALUES (
  UUID(),                           -- Auto-generate unique ID
  'www.105thdelivery.com',          -- Your domain (CHANGE THIS to your actual domain)
  NOW(),                            -- Set as verified right now
  'valid',                          -- Status: valid
  'active',                         -- Client status: active
  'active',                         -- Subscription status: active
  DATE_ADD(NOW(), INTERVAL 1 YEAR), -- Subscription expires in 1 year
  NULL,                             -- No specific user verified it
  NULL,                             -- No additional metadata
  NOW(),                            -- Created now
  NOW()                             -- Updated now
);

-- Verify the record was inserted
SELECT 
  domain,
  last_verified_at,
  verification_status,
  client_status,
  subscription_status,
  subscription_end_date,
  TIMESTAMPDIFF(DAY, last_verified_at, NOW()) as days_since_verification
FROM domain_verification
WHERE domain = 'www.105thdelivery.com';
