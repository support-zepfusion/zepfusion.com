# Zepfusion AI-First Website Redesign

## Repository audit

- Static, dependency-free HTML site deployed from the repository root with a `CNAME` for `zepfusion.com`.
- Shared presentation lives in `zf-styles.css`; pages also contain substantial inline styling and page-specific scripts.
- Tailwind is loaded from its CDN, while Google Fonts provide Bricolage Grotesque and DM Sans.
- The homepage owns the primary enquiry form. Submission behavior is isolated in `scripts/zepfusion-enquiry.js` and remains unchanged.
- SEO foundations already exist: canonical URLs, Open Graph metadata, JSON-LD, `robots.txt`, and `sitemap.xml`.
- Theme switching and responsive navigation are implemented independently in page scripts. Shared components are copied between pages rather than generated from templates.
- Existing routes and active in-progress changes must be preserved. A future component extraction should be a separate migration, not mixed into the positioning redesign.

## Existing page inventory

| Group | Pages | AI-first role |
|---|---|---|
| Core | `index.html`, `enterprise-automation.html` | Platform narrative, agent catalog, orchestration, implementation |
| Industries | `agro-commerce.html`, `healthcare-diagnostics.html`, `legal-law-firms.html`, `education.html` | Industry AI workforces and domain workflows |
| Trust / assets | `real-world-assets.html`, `real-assets.html` | Verifiable ownership, provenance, and asset workflows |
| Proof | Three case-study pages | Outcome-led evidence for document and finance agents |
| Commercial | `product-pricing.html` | Discovery, pilot, deployment, and managed operations packages |
| Legal | Terms, privacy, cancellation, refund pages | Governance and commercial trust; preserve substance |

## Proposed information architecture

1. AI Agents
   - Finance and Invoice
   - Procurement and Vendor
   - Legal and Contract
   - Compliance
   - HR
   - Industry-specific agents
2. Platform
   - AI Fabric
   - Agent Fabric
   - Automation Fabric
   - Knowledge and Data Fabric
   - Integration Fabric
   - Security, Governance, and Human Approval
3. Solutions
   - Document intelligence
   - Agentic workflow automation
   - Enterprise integrations
   - Data and knowledge
4. Industries
   - Agriculture
   - Healthcare
   - Legal
   - Education
   - Regulated asset workflows
5. Services
   - Workflow discovery
   - Agent design and implementation
   - Integration and modernization
   - Managed AI operations
6. Proof and company
   - Case studies
   - About
   - Contact

## Reusable component plan

- Global navigation with AI Agents, Platform, Solutions, Industries, and Contact.
- Agent card with outcome, skills, workflow, integrations, approval model, and CTA.
- Workflow strip: input → agent reasoning → policy checks → human approval → system action.
- Platform layer diagram with consistent six-fabric terminology.
- Trust bar for identity, RBAC, audit, guardrails, data boundaries, and observability.
- Outcome panel with customer-validated metrics only; avoid unsupported percentage claims.
- Industry hero and agent roster shared across all sector pages.
- Standard case-study pattern: context, workflow, controls, integrations, outcome, and next step.

## Content migration map

| Current framing | New framing |
|---|---|
| Technology company | AI-native enterprise software company |
| Digital engine for industry | Enterprise AI agents for real business work |
| Technology stack | Enterprise AI platform |
| AI / NLP capability | AI Fabric and Document Intelligence |
| API and integration services | Enterprise Integration Fabric |
| ERP / SAP implementation | Agents that act safely through systems of record |
| n8n / Flowable | Customer-facing Automation Fabric; underlying orchestration components |
| Sector products | Industry AI workforces |
| Custom software engagement | Agent discovery, pilot, production rollout, managed operations |

## Implementation status

- Completed homepage positioning, metadata, hero CTAs, and navigation hierarchy.
- Added a six-card enterprise AI workforce section.
- Reframed the homepage platform section around a shared secure agent fabric.
- Recast key industry cards as Agriculture, Legal, and Healthcare AI workforces.
- Preserved routes, enquiry behavior, analytics/chat embeds, themes, and deployment structure.
- Verified HTML parsing, local links, semantic heading presence, agent-card count, and browser rendering.

## Next rollout

1. Retrofit each industry page with an agent roster and supervised workflow diagram.
2. Turn `enterprise-automation.html` into the definitive platform and architecture page.
3. Reframe pricing around discovery, pilot, production, and managed AI operations.
4. Normalize copied navigation/footer markup after content stabilizes.
5. Replace unsupported generic metrics with measured case-study outcomes.
6. Add security, model governance, data residency, and human-approval detail.
7. Run accessibility, Lighthouse, responsive, metadata, and form regression checks before release.
