// Billing plan definitions (Phase 1: display only — no payment provider
// is connected, so upgrade buttons are disabled in the UI).

export interface Plan {
  id: 'free' | 'pro' | 'business';
  name: string;
  price: string;
  period: string;
  blurb: string;
  limits: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    blurb: 'Get started and automate your first flows.',
    limits: [
      '5 active workflows',
      '100 executions / month',
      '3 templates',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: 'per month',
    blurb: 'For makers who automate every day.',
    limits: [
      'Unlimited workflows',
      '10,000 executions / month',
      'All templates',
      'All integrations',
      'AI Assistant (Phase 5)',
      'Priority support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$49',
    period: 'per month',
    blurb: 'For teams that run on automation.',
    limits: [
      'Everything in Pro',
      'Unlimited executions',
      'Team workspaces',
      'SSO & audit logs',
      'Dedicated support',
    ],
  },
];

// Phase 1: every account is on the Free plan (no subscriptions exist yet).
export const CURRENT_PLAN_ID: Plan['id'] = 'free';
