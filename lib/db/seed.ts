import { randomUUID } from 'crypto';
import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { learningModules, users } from './schema';
import { hashPassword } from '@/lib/auth/session';

async function createStripeProducts() {
  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800, // $8 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200, // $12 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Stripe products and prices created successfully.');
}

async function seed() {
  const adminEmail = 'admin@test.com';
  const learnerEmail = 'learner@test.com';
  const agentEmail = 'agent@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const [admin] = await db
    .insert(users)
    .values([
      {
        email: adminEmail,
        passwordHash: passwordHash,
        role: 'ADMIN',
      },
      {
        email: learnerEmail,
        passwordHash: passwordHash,
        role: 'LEARNER',
      },
      {
        email: agentEmail,
        passwordHash: passwordHash,
        role: 'AGENT',
      },
    ])
    .returning();

  console.log('Seed users created.');

  await db.insert(learningModules).values([
    {
      sourceModuleId: randomUUID(),
      environment: 'staging',
      status: 'draft',
      title: 'Build a Minimal SaaS Skeleton',
      summary: 'Set up auth, billing, and a safe update flow.',
      bodyMarkdown: '# Module 1\nStart with a minimal SaaS skeleton.',
      checklistJson: [
        {
          step: 'Initialize repository and env vars',
          successCriteria: 'App boots locally with required env vars',
          commonMistakes: 'Missing AUTH_SECRET or STRIPE keys',
          verification: 'Run the dev server and hit /dashboard',
        },
      ],
    },
    {
      sourceModuleId: randomUUID(),
      environment: 'prod',
      status: 'published',
      title: 'Your First Learning Module',
      summary: 'Understand the core workflow for shipping safely.',
      bodyMarkdown: '# Welcome\nThis is the production module.',
      checklistJson: [
        {
          step: 'Read the module overview',
          successCriteria: 'Able to explain the staging → promote flow',
          commonMistakes: 'Editing prod directly',
          verification: 'Describe the approval steps',
        },
      ],
    },
  ]);

  if (admin && process.env.SKIP_STRIPE_SEED !== 'true') {
    await createStripeProducts();
  }
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
