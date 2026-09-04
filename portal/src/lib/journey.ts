/**
 * The client journey manifest.
 *
 * One ordered list, held as data rather than markup, so the Journey tab renders
 * it and anything else that needs the sequence later (a portal progress rail, a
 * status mapper, an onboarding checklist) reads the same source instead of a
 * second copy that drifts.
 *
 * Steps only. No rationale, no detail: this says what happens and in what order.
 */

export type JourneyActor = "client" | "provider" | "both";

export type JourneyStep = {
  n: number;
  actor: JourneyActor;
  text: string;
};

export type JourneyPhase = {
  title: string;
  /** Set on the phase that loops. */
  repeats?: boolean;
  steps: JourneyStep[];
};

/* "Provider" rather than a company name. This manifest describes the delivery
   service every site on the platform resells, so the actor is a role: whichever
   site sold this client is the one doing these steps. */
export const ACTOR_LABEL: Record<JourneyActor, string> = {
  client: "Client",
  provider: "Provider",
  both: "Both",
};

export const JOURNEY: JourneyPhase[] = [
  {
    title: "Onboarding",
    steps: [
      { n: 1, actor: "client", text: "Buys a package" },
      { n: 2, actor: "client", text: "Lands in the portal" },
      { n: 3, actor: "client", text: "Sees the package and its details" },
      { n: 4, actor: "client", text: "Fills in the brief about the business" },
      { n: 5, actor: "client", text: "Submits the brief" },
      { n: 6, actor: "provider", text: "Gets notified of the submission" },
      { n: 7, actor: "provider", text: "Confirms the brief was received and work has started" },
      { n: 8, actor: "provider", text: "Runs a comprehensive audit" },
      { n: 9, actor: "provider", text: "Submits the audit report" },
    ],
  },
  {
    title: "Monthly cycle",
    repeats: true,
    steps: [
      { n: 10, actor: "provider", text: "Builds the content plan" },
      { n: 11, actor: "provider", text: "Submits the plan" },
      { n: 12, actor: "client", text: "Approves the plan" },
      { n: 13, actor: "provider", text: "Produces the posts" },
      { n: 14, actor: "provider", text: "Uploads the designs and captions" },
      { n: 15, actor: "client", text: "Sees the posts in the portal" },
      { n: 16, actor: "client", text: "Approves or leaves comments" },
      { n: 17, actor: "provider", text: "Applies the corrections" },
      { n: 18, actor: "provider", text: "Schedules the posts in the HL Social Planner" },
      { n: 19, actor: "provider", text: "Confirms the schedule to the client" },
      { n: 20, actor: "provider", text: "Sends the month end report and requests a meeting" },
      { n: 21, actor: "client", text: "Books a meeting date and time" },
      { n: 22, actor: "both", text: "Holds the meeting" },
      { n: 23, actor: "provider", text: "Builds the plan for the next month" },
    ],
  },
];

/** Where the loop returns to, named once so the tab does not hard code it. */
export const JOURNEY_LOOPS_TO = 10;
