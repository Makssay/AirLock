# Airlock business model

[English](BUSINESS-MODEL.md) | [Русский](ru/BUSINESS-MODEL.md)

Prepared November 1, 2026. The Airlock prices below are proposals to validate through pilots, not live plans or confirmed revenue. All amounts are in USD. External benchmarks were checked against providers' pages on this date.

## Proposed model

The public contracts and self-hosted software remain free. Proposed revenue comes from onboarding and a subscription for treasury operations: configuration, observer operation, notification delivery, guardian readiness checks and operation history. Customers retain their keys and make payout decisions.

The first price to validate is **$500 for onboarding + $99 per month for one treasury**. A package for multiple treasuries would cost **$249 per month**, after demand is validated and the corresponding service is implemented. This model includes neither a per-payout fee nor a project token.

## Initial customer

Working persona, not an existing customer: a small protocol team that already runs a recurring payout service. One engineer maintains the relay, an operations lead owns payments, and a separate participant acts as guardian.

Scenario: the relay creates payout requests for contributors. The team wants limits on immediate spending and time to review larger requests while allowing legitimate payments after the delay. The buyer is an engineering or operations lead with an infrastructure budget; users are the treasury operator and guardian.

First-pilot qualification:

- The team already automates payouts and has a named process owner.
- The team will use a separate test treasury and provide feedback.
- Its source flow is compatible; the first pilot is limited to the current reference adapter.
- RPC access, test funds and operator-wallet budgets are confirmed before the live V3 stage.

Acquisition path: Try Airlock demonstration → 20-minute workflow interview → scoped pilot → agreed paid onboarding and subscription. No prospect outreach has been sent.

## Proposed packages

| Package | Proposed price | Scope | Status |
| --- | --- | --- | --- |
| Community | $0 for software | MIT source, contracts, documentation and self-hosting; the operator funds infrastructure | Available in the repository; the public playground is free |
| Core | $99/month | 1 treasury, 1 agreed source flow, 1 guardian Telegram chat, observer, operator-funding checks, 30-day history and up to 30 minutes of support per month | Package to validate after the pilot; the managed V3 service has not launched |
| Team | $249/month | Up to 3 treasuries on agreed networks, up to 5 notification contacts, a fallback delivery channel, 90-day history, monthly review and up to 90 minutes of support | Target package; multi-customer routing and operations require development |
| Onboarding | $500 once | Supported adapter, separate deployment, policy configuration, operator-funding checks, training exercise and operating guide; target effort up to 6 hours | Proposal for estimation; custom adapters are scoped separately |

Subscriptions are priced per managed treasury rather than by the value of its assets. The Team package limits the number of treasuries and contacts. Airlock receives no guardian authority under this offer: customers sign actions through their own tools. Customer wallets fund gas and storage deposits separately.

Support is provided during business hours agreed with the customer. Continuous automated observation and round-the-clock human response are separate services; the latter is not included in these prices. No human-response SLA, insurance coverage or promise to prevent every loss is offered.

## What the product demonstrates

The V3 contract, recorded transactions and initial Sepolia integration exist. The local operator console checks guardian readiness and recovers interrupted requests. The V3 observer runs on the developer machine. The educational cloud playground stores isolated sessions; a live run confirmed Telegram acceptance of all seven notifications.

A paid production V3 monitoring service, multiple customers, RPC redundancy, paid support and extended retention still require implementation and validation. The cloud playground does not establish readiness of that service. Revenue, signed pilots and willingness to pay have not been validated.

## Market benchmarks and interpretation

| Source | Verified benchmark | Implication for Airlock |
| --- | --- | --- |
| [Tenderly](https://tenderly.co/pricing) | Its team offering includes event and cross-chain monitoring, automated actions and Telegram delivery. An individual free version is available; team capacity is discussed with sales | Alerts are already available in the market. Validate the value of implementing the treasury policy and complete guardian workflow on V3; message delivery alone is insufficient differentiation |
| [PagerDuty](https://www.pagerduty.com/pricing/) | Professional: $25 per user per month when billed monthly, or $21 per user per month with annual billing | A benchmark for paid operational workflows. It is a general incident service; its per-user price is not equivalent to our per-treasury price |
| [Vercel](https://vercel.com/pricing) | Pro is listed at $20/month; additional consumption depends on usage | One frontend budget anchor. This is neither our actual invoice nor the total system cost |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/) | Standard pricing examples use a $5/month base subscription plus consumption | A compute-layer budget anchor. It does not establish current Sites hosting costs or include V3 RPC and support |

Our inference is a hypothesis: teams may pay for an agreed policy, integration and an operated process from request to guardian decision. These sources establish adjacent paid offerings; they do not prove demand for Airlock, competitor support for Portaldot or the adequacy of our proposed prices.

## Planning economics

All values below are assumptions for a small managed customer group, not measured operating expenses. Machine-readable calculations are in `artifacts/business-model.json`.

Shared monthly infrastructure allowance: **$100**.

| Item | Budget |
| --- | ---: |
| Frontend and API | $20 |
| Persistent observer and database | $15 |
| Primary/fallback RPC access | $40 |
| External availability checks, logs and backups | $15 |
| Usage reserve | $10 |
| Total | $100 |

The RPC allowance is a placeholder until a V3-specific quote is available. A self-operated node, dedicated RPC or heavy usage could materially change it. Current free allowances are not a guarantee of future costs.

Use an assumed loaded labor rate of **$40/hour** and a payment-processing reserve of **3% of revenue**. The latter is a planning allowance, not a selected processor's quoted fee.

| Per customer per month | Core | Team |
| --- | ---: | ---: |
| Revenue | $99.00 | $249.00 |
| Support: 0.5 / 1.5 hours | $20.00 | $60.00 |
| Maintenance: 0.25 / 0.5 hours | $10.00 | $20.00 |
| Incremental usage | $5.00 | $10.00 |
| Payment-processing reserve, 3% | $2.97 | $7.47 |
| Variable cost | $37.97 | $97.47 |
| Contribution before shared infrastructure | $61.03 | $151.53 |

| Illustrative cohort | Monthly revenue | Variable cost | Shared infrastructure | Remainder |
| --- | ---: | ---: | ---: | ---: |
| 10 Core | $990.00 | $379.70 | $100.00 | $510.30 |
| 3 Team | $747.00 | $292.41 | $100.00 | $354.59 |
| 5 Core + 3 Team | $1,242.00 | $482.26 | $100.00 | $659.74 |

These are neither sales forecasts nor net-profit figures. The remainder excludes separately budgeted customer acquisition, core product R&D, independent security review, taxes and other team overhead. Onboarding revenue is not added to MRR.

Under these assumptions, two Core customers cover the $100 shared infrastructure allowance and budgeted variable costs. This is not company-wide break-even. At $500 of shared infrastructure, 9 Core customers would be needed.

Sensitivity: if a Core customer takes 2 hours of monthly support instead of 0.5, variable cost rises to $97.97 and contribution falls to $1.03. Ten such customers leave **–$89.70/month** after $100 of shared infrastructure. Measure manual effort, bound it within the package and revisit pricing before scaling.

For $500 onboarding: 6 hours at $40 = $240, direct-cost reserve $25, payment reserve $15; planned remainder $220 before other costs. Re-scope and re-price work exceeding six hours.

## Pilot and launch decision

Proposed pilot: up to three design partners, 14 days, one test treasury per team. Scoped setup and support are free, with Airlock effort capped at 6 hours per pilot. Start with the playground and workflow review. The live V3 stage begins after network and test-operator funding checks; additional tPOT from our team is not promised.

Budget for three pilots: 18 hours at $40 = $720 of labor, $50 of shared infrastructure for half a month and $60 of usage reserve. Total planned resources: $830, comprising $110 cash and $720 labor. These are budgets, not incurred expenses. Actual current product costs have not been measured separately.

Validate the following before expanding:

1. Five workflow interviews with teams already automating payouts.
2. Up to three scoped pilots with a named process owner.
3. A normal payout, a legitimate delayed payout and a stopped unwanted request in the selected environment, with accurate environment labels.
4. Notification timing, read availability and operator balances. Measure human response and transaction finality separately. Target p95 observation-to-Telegram-acceptance below 10 seconds for test signals; this is a pilot target, not a current SLA or a guarantee of a response within quarantine.
5. No more than 6 total hours of manual effort per pilot. For a subscription, measure expected monthly support against the Core allowance of 30 minutes.
6. At least two concrete pricing discussions and one agreed paid continuation after prerequisites are met. Revenue begins with actual payment.

If paid interest is not established, revise the package or customer segment. If integrations require ongoing custom development, validate paid implementation and integration support before promising a standardized subscription.

The ready-to-send offer and interview questions are in [PILOT-OFFER.md](PILOT-OFFER.md). No prospect contacts were collected, outreach sent or payment collection enabled.
