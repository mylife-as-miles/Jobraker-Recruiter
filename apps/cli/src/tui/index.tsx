import React from "react";
import { render } from "ink";
import { JobrakerRecruiterTui } from "./ui.js";

export function runTui({ serverUrl }: { serverUrl?: string }) {
    const baseUrl = serverUrl ?? process.env.JOBRAKER_RECRUITER_X_SERVER_URL ?? "http://127.0.0.1:3000";
    render(<JobrakerRecruiterTui serverUrl={baseUrl} />);
}
