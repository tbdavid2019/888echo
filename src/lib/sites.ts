import type { D1Database } from "@cloudflare/workers-types";
import { listSites, normalizeDomain, type Site } from "../db/queries";

export const SITES_MEMO_TTL_MS = 60_000;

type MemoEntry = {
	at: number;
	sites: Site[];
	inFlight?: Promise<Site[]>;
};

const sitesMemo = new WeakMap<D1Database, MemoEntry>();
let cacheBustCounter = 0;
const entryBustCounters = new WeakMap<D1Database, number>();

export const clearSitesCache = (db?: D1Database): void => {
	cacheBustCounter++;
	if (db) {
		sitesMemo.delete(db);
	}
};

export const getCachedSitesSync = (db?: D1Database): Site[] => {
	if (!db) return [];
	return sitesMemo.get(db)?.sites ?? [];
};

export const getCachedSites = async (db: D1Database): Promise<Site[]> => {
	const now = Date.now();
	const entry = sitesMemo.get(db);
	const entryCounter = entryBustCounters.get(db) ?? 0;
	if (entry && entryCounter === cacheBustCounter && now - entry.at < SITES_MEMO_TTL_MS) {
		return entry.sites;
	}
	if (entry?.inFlight) {
		return entry.inFlight;
	}

	const inFlight = listSites(db)
		.then((sites) => {
			sitesMemo.set(db, { at: Date.now(), sites });
			entryBustCounters.set(db, cacheBustCounter);
			return sites;
		})
		.catch((_err) => {
			if (entry) return entry.sites;
			return [];
		})
		.finally(() => {
			const cur = sitesMemo.get(db);
			if (cur && cur.inFlight === inFlight) {
				delete cur.inFlight;
			}
		});

	if (entry) {
		entry.inFlight = inFlight;
	} else {
		sitesMemo.set(db, { at: 0, sites: [], inFlight });
	}
	return inFlight;
};

export type RequestLike = {
	header?: (name: string) => string | undefined;
	query?: (name: string) => string | undefined;
	headers?: Headers;
	url?: string;
};

export const extractCandidateDomains = (req: RequestLike): string[] => {
	const candidates: string[] = [];
	const getHeader = (name: string): string | undefined => {
		if (typeof req.header === "function") return req.header(name);
		if (req.headers && typeof req.headers.get === "function") {
			return req.headers.get(name) ?? undefined;
		}
		return undefined;
	};
	const getQuery = (name: string): string | undefined => {
		if (typeof req.query === "function") return req.query(name);
		if (req.url) {
			try {
				const u = new URL(req.url, "http://localhost");
				return u.searchParams.get(name) ?? undefined;
			} catch {
				return undefined;
			}
		}
		return undefined;
	};

	const origin = getHeader("origin");
	if (origin && origin !== "null") {
		const d = normalizeDomain(origin);
		if (d) candidates.push(d);
	}

	const referer = getHeader("referer");
	if (referer) {
		const d = normalizeDomain(referer);
		if (d) candidates.push(d);
	}

	const parentOrigin = getQuery("parent_origin");
	if (parentOrigin) {
		const d = normalizeDomain(parentOrigin);
		if (d) candidates.push(d);
	}

	const xSite = getHeader("x-888echo-site") || getHeader("x-site-id");
	if (xSite) {
		candidates.push(xSite.trim().toLowerCase());
	}

	const qSite = getQuery("site_id");
	if (qSite) {
		candidates.push(qSite.trim().toLowerCase());
	}

	return candidates;
};

export const resolveRequestSite = async (
	req: RequestLike,
	db: D1Database,
): Promise<Site | null> => {
	const sites = await getCachedSites(db);
	if (sites.length === 0) return null;

	const candidates = extractCandidateDomains(req);
	for (const candidate of candidates) {
		const matched = sites.find(
			(s) => s.domain.toLowerCase() === candidate || s.id.toLowerCase() === candidate,
		);
		if (matched) return matched;
	}
	return null;
};
