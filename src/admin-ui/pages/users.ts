import type { User } from "../../db/queries";
import { escapeHtml, jsLiteral } from "../escape";

export const renderUsers = (
	rows: User[],
	q: string,
	nextCursor: string | null,
	isZh: boolean = false,
): string => {
	const rolePill = (u: User): string => {
		if (u.role === "admin") return `<span class="pill admin">${isZh ? "管理員" : "admin"}</span>`;
		if (u.role === "mod") return `<span class="pill mod">${isZh ? "審核員" : "mod"}</span>`;
		return "";
	};
	const rowsHtml = rows.length
		? rows
				.map(
					(u) => `
<tr x-data="{ busy: false, banned: ${u.is_banned} }">
  <td>
    <div><a href="/admin/users/${escapeHtml(u.id)}">${escapeHtml(u.name)}</a> ${rolePill(u)}
      <span x-show="banned" class="pill banned">${isZh ? "已封鎖" : "banned"}</span></div>
    <div class="muted">${escapeHtml(u.email ?? "—")}</div>
  </td>
  <td>${escapeHtml(u.provider)}</td>
  <td class="muted">${new Date(u.created_at).toISOString().slice(0, 10)}</td>
  <td class="actions">
    <template x-if="!banned">
      <button :disabled="busy" class="bad" @click="busy=true; setBanned(${jsLiteral(u.id)}, true).then(()=>{banned=true}).finally(()=>busy=false)">${isZh ? "封鎖" : "Ban"}</button>
    </template>
    <template x-if="banned">
      <button :disabled="busy" @click="busy=true; setBanned(${jsLiteral(u.id)}, false).then(()=>{banned=false}).finally(()=>busy=false)">${isZh ? "解除封鎖" : "Unban"}</button>
    </template>
  </td>
</tr>`,
				)
				.join("")
		: `<tr><td colspan="4" class="muted">${isZh ? "找不到相符的使用者。" : "No users match."}</td></tr>`;

	const queryStr = q ? `&q=${encodeURIComponent(q)}` : "";
	const next = nextCursor
		? `<a href="/admin/users?before=${encodeURIComponent(nextCursor)}${queryStr}">${isZh ? "下一頁 →" : "Next →"}</a>`
		: `<span class="muted">${isZh ? "已到底部" : "end"}</span>`;

	return `
<div class="card" x-data="{
  setBanned(id, banned) {
    return fetch('/admin/api/users/' + id, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ banned }),
    }).then(r => {
      if (!r.ok) throw new Error('action failed: ' + r.status);
    });
  }
}">
  <form class="filter-bar" method="get" action="/admin/users">
    <input type="text" name="q" placeholder="${isZh ? "搜尋姓名或電子信箱" : "search name or email"}" value="${escapeHtml(q)}">
    <button type="submit">${isZh ? "搜尋" : "Search"}</button>
    ${q ? `<a href="/admin/users">${isZh ? "清除" : "clear"}</a>` : ""}
  </form>
  <table>
    <thead><tr>
      <th>${isZh ? "使用者" : "User"}</th>
      <th>${isZh ? "登入方式" : "Provider"}</th>
      <th>${isZh ? "加入時間" : "Joined"}</th>
      <th>${isZh ? "操作" : "Actions"}</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="pager">${next}</div>
</div>`;
};
