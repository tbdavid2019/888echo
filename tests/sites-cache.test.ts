import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCachedSites, clearSitesCache, SITES_MEMO_TTL_MS } from "../src/lib/sites";
import type { D1Database } from "@cloudflare/workers-types";
import { asD1 } from "./helpers/d1";

describe("Sites In-Memory Cache (sitesMemo)", () => {
	beforeEach(() => {
		clearSitesCache();
		vi.useRealTimers();
	});

	it("caches sites and avoids redundant DB queries within TTL", async () => {
		let queryCount = 0;
		const fakeSites = [
			{
				id: "01SITE1",
				domain: "site1.com",
				name: "Site 1",
				description: null,
				default_locale: "zh-Hant",
				allow_anonymous: 1,
				auto_close_days: 0,
				created_at: 1000,
				updated_at: 1000,
			},
		];

		const db = asD1({
			prepare(sql: string) {
				return {
					async all() {
						queryCount++;
						return { results: fakeSites };
					},
				};
			},
		});

		const first = await getCachedSites(db);
		expect(queryCount).toBe(1);
		expect(first.length).toBe(1);
		expect(first[0]?.domain).toBe("site1.com");

		const second = await getCachedSites(db);
		expect(queryCount).toBe(1);
		expect(second).toBe(first);
	});

	it("invalidates cache when clearSitesCache is called", async () => {
		let queryCount = 0;
		const db = asD1({
			prepare() {
				return {
					async all() {
						queryCount++;
						return { results: [] };
					},
				};
			},
		});

		await getCachedSites(db);
		expect(queryCount).toBe(1);

		clearSitesCache();
		await getCachedSites(db);
		expect(queryCount).toBe(2);
	});

	it("refreshes after TTL expires", async () => {
		vi.useFakeTimers();
		let queryCount = 0;
		const db = asD1({
			prepare() {
				return {
					async all() {
						queryCount++;
						return { results: [] };
					},
				};
			},
		});

		await getCachedSites(db);
		expect(queryCount).toBe(1);

		vi.advanceTimersByTime(SITES_MEMO_TTL_MS - 100);
		await getCachedSites(db);
		expect(queryCount).toBe(1);

		vi.advanceTimersByTime(200);
		await getCachedSites(db);
		expect(queryCount).toBe(2);
	});
});
