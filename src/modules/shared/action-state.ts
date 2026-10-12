export type ActionState = { ok?: boolean; message?: string };
export type FormAction = (state: ActionState, data: FormData) => Promise<ActionState>;
