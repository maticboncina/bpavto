import axios, { AxiosError } from "axios";
import contentType from "content-type";
import * as z from "zod";
import { useChromeState } from "./state/state";

type JsonParseResult =
    | {
          success: false;
          data: undefined;
      }
    | {
          success: true;
          data: any;
      };

export const safeParseJson = (data: any): JsonParseResult => {
    let parsed;

    try {
        parsed = JSON.parse(data);
    } catch {
        return {
            success: false,
            data: undefined,
        };
    }

    return {
        success: true,
        data: parsed,
    };
};

const ExpectedResponseSchema = z.object({
    status: z.number(),
    data: z.string(),
    errors: z.array(z.string()),
});

const http = axios.create({
    timeout: 120_000,
    transformResponse: (data, headers) => {
        if (!headers) return data;

        const header = headers.get("content-type");

        if (typeof header !== "string" || contentType.parse(header).type !== "application/json")
            return data;

        const jsonParseResult = safeParseJson(data);

        if (!jsonParseResult.success) return data;

        const parseResult = ExpectedResponseSchema.safeParse(jsonParseResult.data);

        if (!parseResult.success) return jsonParseResult.data;

        return parseResult.data;
    },
});

http.interceptors.request.use((config) => {
    const accessToken = useChromeState.getState().accessToken;
    const portalUrl = useChromeState.getState().portalUrl;

    console.log('HTTP Request Debug:', {
        accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : 'MISSING',
        url: `${portalUrl}/api${config.url}`,
        hasToken: !!accessToken
    });

    if (accessToken && config.headers) config.headers["Authorization"] = `Bearer ${accessToken}`;

    config.baseURL = `${portalUrl}/api`;

    return config;
});

http.interceptors.response.use(
    (config) => config,
    (error) => {
        if (error instanceof AxiosError && error.response?.status === 401) {
            useChromeState.getState().setAccessToken("");
        }

        return Promise.reject(error);
    }
);

export { http };
