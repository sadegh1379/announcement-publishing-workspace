import type { IAnnouncement } from "./contracts";

export const createAnnouncements = (): IAnnouncement[] => [
  {
    id: "ann-101",
    title: "Service Maintenance Notice",
    body: "Our online services will be briefly unavailable during the scheduled maintenance window. We appreciate your patience while we improve reliability.",
  },
  {
    id: "ann-102",
    title: "New Feature Launch",
    body: "The new workspace search is ready. Customers can find their saved items using the updated search experience in their account.",
  },
  {
    id: "ann-103",
    title: "Support Hours Update",
    body: "Our support team has updated its availability. Please consult the support page for the latest hours before contacting the team.",
  },
];
