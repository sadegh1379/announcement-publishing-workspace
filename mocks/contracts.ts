export interface IAnnouncement {
  id: string;
  title: string;
  body: string;
}

interface IOperationIdentity {
  operationId: string;
  announcementId: string;
  createdAt: string;
}

export type PublicationOperation = IOperationIdentity & (
  | { status: "processing"; version: 1 }
  | { status: "published"; version: 2; publicationId: string; publishedAt: string }
  | { status: "rejected"; version: 2; reason: string }
);

export type AnnouncementScenario =
  | "success"
  | "explicit-rejection"
  | "lost-response"
  | "status-check-failure"
  | "overlapping"
  | "slow-response";

export type AnnouncementErrorCode =
  | "RESPONSE_LOST"
  | "STATUS_UNAVAILABLE"
  | "UNKNOWN_ANNOUNCEMENT"
  | "OPERATION_ID_CONFLICT";

export interface IAnnouncementService {
  getAnnouncements(): Promise<IAnnouncement[]>;
  listOperations(): Promise<PublicationOperation[]>;
  publish(announcementId: string, operationId: string): Promise<PublicationOperation>;
  getStatus(operationId: string): Promise<PublicationOperation | null>;
  setScenario(scenario: AnnouncementScenario): void;
  getScenario(): AnnouncementScenario;
  reset(): void;
}
