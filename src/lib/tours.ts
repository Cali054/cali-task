/**
 * Guided tours, one per page. Each step points at an element tagged with
 * `data-tour="<target>"`. When a step lists several targets the first one
 * visible on screen is used (e.g. the sidebar on desktop, the menu button on
 * phones). A step with no visible target is shown centered on screen.
 */
export interface TourStep {
  target?: string | string[];
  title: string;
  body: string;
}

export interface Tour {
  id: TourId;
  name: string;
  steps: TourStep[];
}

export const TOUR_IDS = ["overview", "tasks", "board", "timeline", "blocked", "reports", "settings"] as const;
export type TourId = (typeof TOUR_IDS)[number];

const ROUTES: Record<string, TourId> = {
  "/": "overview",
  "/tasks": "tasks",
  "/board": "board",
  "/timeline": "timeline",
  "/blocked": "blocked",
  "/reports": "reports",
  "/settings": "settings",
};

export function tourForPath(pathname: string): TourId | null {
  return ROUTES[pathname] ?? null;
}

export const TOURS: Record<TourId, Tour> = {
  overview: {
    id: "overview",
    name: "Overview",
    steps: [
      {
        title: "Welcome to Cali's Task 👋",
        body: "Let's take a quick look around. Each page has its own short tour the first time you open it — it only takes a minute.",
      },
      {
        target: "sprint-hero",
        title: "Your active sprint",
        body: "See how far along the sprint is: completion, dates, working days left, and how much time has passed.",
      },
      {
        target: "quick-actions",
        title: "Quick actions",
        body: "Create tasks and sprints, log time with Update Progress, or flag a blocker — all from here.",
      },
      {
        target: "stats",
        title: "Sprint at a glance",
        body: "Totals for every status, the estimated days remaining and your completion rate. Tap any card to jump to the details.",
      },
      {
        target: "blocked-panel",
        title: "Blocked tasks stay visible",
        body: "Anything waiting on clarification shows up here with how long it's been blocked and who you're waiting on.",
      },
      {
        target: "planning",
        title: "Planning check",
        body: "Compares the target you committed to with the sum of task estimates, so you can spot an over-full sprint early.",
      },
      {
        target: ["nav", "nav-mobile"],
        title: "Find your way around",
        body: "Tasks, the Sprint Board, Timeline, Blocked Tasks, Reports and Settings all live here.",
      },
      {
        target: "help",
        title: "Need a refresher?",
        body: "Tap the ? button on any page to replay its tour.",
      },
    ],
  },
  tasks: {
    id: "tasks",
    name: "My Tasks",
    steps: [
      {
        target: "tasks-new",
        title: "Add a task",
        body: "Give it an ID, title, estimate, priority, dates, dependencies and notes. Log time spent with Log time.",
      },
      {
        target: "tasks-filters",
        title: "Search, filter and sort",
        body: "Filter by sprint, status, priority or overdue tasks, and sort by deadline, priority, status or ID.",
      },
      {
        target: "tasks-list",
        title: "Your task list",
        body: "Change a task's status right from the list. Tap a task to open its details, history and time logs.",
      },
    ],
  },
  board: {
    id: "board",
    name: "Sprint Board",
    steps: [
      {
        target: "board-columns",
        title: "Your sprint as a board",
        body: "Each column is a status. Drag a card to another column to update it — moving to Blocked asks you for the reason.",
      },
      {
        target: "board-new",
        title: "Add tasks anywhere",
        body: "Use New task here, or the + Add task button at the bottom of a column to create it with that status.",
      },
    ],
  },
  timeline: {
    id: "timeline",
    name: "Timeline",
    steps: [
      {
        target: "timeline-summary",
        title: "Effort summary",
        body: "Estimated work remaining, actual time spent, and how much is completed versus still open.",
      },
      {
        target: "timeline-chart",
        title: "Sprint timeline",
        body: "Each bar runs from a task's start to its target date. Flags mark completions, dashed amber bars mark delays, and the line marks today.",
      },
      {
        target: "timeline-variance",
        title: "Estimated vs actual",
        body: "See which tasks are taking longer than planned — bars turn amber when a task goes over its estimate.",
      },
    ],
  },
  blocked: {
    id: "blocked",
    name: "Blocked Tasks",
    steps: [
      {
        target: "blocked-add",
        title: "Flag a blocker",
        body: "Record why a task is blocked, who you're waiting on, and what action will unblock it.",
      },
      {
        target: "blocked-list",
        title: "Track and resolve",
        body: "Each blocked task shows how many days it's been stuck. Add updates as you hear back, and choose Unblock when it's resolved.",
      },
    ],
  },
  reports: {
    id: "reports",
    name: "Reports",
    steps: [
      {
        target: "reports-kpis",
        title: "Sprint health",
        body: "Completion, finished and pending tasks, blockers, and estimated versus actual effort.",
      },
      {
        target: "reports-burndown",
        title: "Burndown",
        body: "The dashed line is the ideal pace; the solid line is the effort actually remaining. Above the line means you're behind.",
      },
      {
        target: "reports-table",
        title: "Prefer numbers?",
        body: "Switch any chart to a table to see the exact values.",
      },
    ],
  },
  settings: {
    id: "settings",
    name: "Settings",
    steps: [
      {
        target: "settings-profile",
        title: "Your profile",
        body: "Change the name in your welcome message, and see when you accepted the Privacy Policy and Terms.",
      },
      {
        target: "settings-appearance",
        title: "Look and tours",
        body: "Switch between light and dark mode, control the intro animation, and restart or turn off these guided tours.",
      },
      {
        target: "settings-sprints",
        title: "Sprints",
        body: "Create, edit, switch between and delete sprints.",
      },
      {
        target: "settings-data",
        title: "Your data",
        body: "Everything is stored in this browser. Export a backup regularly, import one, or load sample data to explore.",
      },
    ],
  },
};
