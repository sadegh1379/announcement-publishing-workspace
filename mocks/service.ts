import type {
  AnnouncementErrorCode,
  AnnouncementScenario,
  IAnnouncementService,
  PublicationOperation,
} from "./contracts";
import { createAnnouncements } from "./fixtures";

export const ANNOUNCEMENT_SCENARIOS = [
  "success", "explicit-rejection", "lost-response", "status-check-failure",
  "overlapping", "slow-response",
] as const satisfies readonly AnnouncementScenario[];

const STORAGE_KEY = "announcement-workspace:mock-service:v1";
const REJECTION_REASON = "This announcement was declined by the publication service.";

interface IStoredOperation {
  operationId: string;
  announcementId: string;
  createdAt: number;
  completesAt: number;
  generation: number;
  status: "processing" | "published" | "rejected";
  publishCalls: number;
  statusFailuresRemaining: number;
  losesFirstResponse: boolean;
  firstResponseDelay: number;
}

interface IStoredService {
  schema: 1;
  generation: number;
  requestCount: number;
  scenario: AnnouncementScenario;
  operations: IStoredOperation[];
}

interface IServiceEnvironment {
  storage: Pick<Storage, "getItem" | "setItem">;
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
}

export class AnnouncementMockError extends Error {
  constructor(
    readonly code: AnnouncementErrorCode,
    readonly requestId: string,
    readonly operationId?: string,
    readonly announcementId?: string,
  ) {
    super({
      RESPONSE_LOST: "The publication response could not be received.",
      STATUS_UNAVAILABLE: "Publication status is temporarily unavailable.",
      UNKNOWN_ANNOUNCEMENT: "The announcement does not exist.",
      OPERATION_ID_CONFLICT: "This operation ID belongs to another announcement.",
    }[code]);
    this.name = "AnnouncementMockError";
  }
}

const createState = (generation = 1): IStoredService => ({
  schema: 1, generation, requestCount: 0, scenario: "success", operations: [],
});

const validateId = (value: string): void => {
  if (typeof value !== "string" || !value.trim() || value.length > 100) {
    throw new TypeError("IDs must be nonblank strings of at most 100 characters");
  }
};

const project = (operation: IStoredOperation): PublicationOperation => {
  const identity = {
    operationId: operation.operationId,
    announcementId: operation.announcementId,
    createdAt: new Date(operation.createdAt).toISOString(),
  };
  if (operation.status === "processing") return { ...identity, status: "processing", version: 1 };
  if (operation.status === "rejected") return {
    ...identity, status: "rejected", version: 2, reason: REJECTION_REASON,
  };
  return {
    ...identity, status: "published", version: 2,
    publicationId: `publication-g${operation.generation}-${operation.operationId}`,
    publishedAt: new Date(operation.completesAt).toISOString(),
  };
};

const getProfile = (scenario: AnnouncementScenario, announcementId: string) => {
  if (scenario === "overlapping") {
    const profiles: Record<string, { duration: number; delay: number }> = {
      "ann-101": { duration: 10_000, delay: 600 },
      "ann-102": { duration: 2_000, delay: 80 },
      "ann-103": { duration: 6_000, delay: 200 },
    };
    const profile = profiles[announcementId]!;
    return { duration: profile.duration, delay: profile.delay };
  }
  if (scenario === "explicit-rejection") return { duration: 0, delay: 120 };
  if (scenario === "slow-response") return { duration: 1_500, delay: 4_500 };
  return { duration: scenario === "success" ? 2_500 : 3_000, delay: 120 };
};

export const createService = (environment: IServiceEnvironment): IAnnouncementService => {
  const load = (): IStoredService => {
    const saved = environment.storage.getItem(STORAGE_KEY);
    return saved === null ? createState() : JSON.parse(saved) as IStoredService;
  };
  const save = (state: IStoredService): void => {
    environment.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  };
  const beginRequest = () => {
    const state = load();
    const now = environment.now();
    for (const operation of state.operations) {
      if (operation.status === "processing" && now >= operation.completesAt) {
        operation.status = "published";
      }
    }
    const requestId = `request-g${state.generation}-${++state.requestCount}`;
    return { state, requestId };
  };
  const deliver = async <T>(value: T, delay: number, error?: AnnouncementMockError): Promise<T> => {
    await environment.wait(delay);
    if (error) throw error;
    return value;
  };
  const consumeStatusFailure = (operations: IStoredOperation[], requestId: string) => {
    const operation = operations.find((entry) => entry.statusFailuresRemaining > 0);
    if (!operation) return undefined;
    operation.statusFailuresRemaining -= 1;
    return new AnnouncementMockError(
      "STATUS_UNAVAILABLE", requestId, operation.operationId, operation.announcementId,
    );
  };

  return {
    getAnnouncements: async () => {
      const { state } = beginRequest();
      save(state);
      return deliver(createAnnouncements(), 80);
    },
    listOperations: async () => {
      const { state, requestId } = beginRequest();
      const error = consumeStatusFailure(state.operations, requestId);
      const result = state.operations.map(project);
      save(state);
      return deliver(result, 100, error);
    },
    publish: async (announcementId, operationId) => {
      validateId(announcementId);
      validateId(operationId);
      const { state, requestId } = beginRequest();
      if (!createAnnouncements().some((item) => item.id === announcementId)) {
        save(state);
        throw new AnnouncementMockError("UNKNOWN_ANNOUNCEMENT", requestId, operationId, announcementId);
      }
      let operation = state.operations.find((entry) => entry.operationId === operationId);
      if (operation && operation.announcementId !== announcementId) {
        save(state);
        throw new AnnouncementMockError("OPERATION_ID_CONFLICT", requestId, operationId, announcementId);
      }
      if (!operation) {
        const profile = getProfile(state.scenario, announcementId);
        const now = environment.now();
        operation = {
          operationId, announcementId, createdAt: now, completesAt: now + profile.duration,
          generation: state.generation,
          status: state.scenario === "explicit-rejection" ? "rejected" : "processing",
          publishCalls: 0,
          statusFailuresRemaining: state.scenario === "status-check-failure" ? 1 : 0,
          losesFirstResponse: state.scenario === "lost-response" || state.scenario === "status-check-failure",
          firstResponseDelay: profile.delay,
        };
        state.operations.push(operation);
      }
      operation.publishCalls += 1;
      const isFirstCall = operation.publishCalls === 1;
      const result = project(operation);
      const error = isFirstCall && operation.losesFirstResponse
        ? new AnnouncementMockError("RESPONSE_LOST", requestId, operationId, announcementId)
        : undefined;
      const delay = isFirstCall ? operation.firstResponseDelay : 120;
      save(state);
      return deliver(result, delay, error);
    },
    getStatus: async (operationId) => {
      validateId(operationId);
      const { state, requestId } = beginRequest();
      const operation = state.operations.find((entry) => entry.operationId === operationId);
      const error = consumeStatusFailure(operation ? [operation] : [], requestId);
      const result = operation ? project(operation) : null;
      save(state);
      return deliver(result, 100, error);
    },
    setScenario: (scenario) => {
      if (!ANNOUNCEMENT_SCENARIOS.includes(scenario)) throw new RangeError("Unknown announcement scenario");
      const state = load();
      state.scenario = scenario;
      save(state);
    },
    getScenario: () => load().scenario,
    reset: () => save(createState(load().generation + 1)),
  };
};

export const createAnnouncementMock = (): IAnnouncementService => createService({
  storage: globalThis.sessionStorage,
  now: () => Date.now(),
  wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
});
