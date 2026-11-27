"use client";

// WEB-2135 (paritet E): "Zahtjevi rada" with the faculty profile, and the "Fakultet i profil" dialog.
// The profile comes from sign-in and the assignment in the real app; until the server gives it, invented
// profiles are shown and the Lekta package is "nedostupno" (Q-11). A collaborator only reads.
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Details, Dialog, Tag } from "@ductura/ui";

import { useDialogRequest } from "../../../../../../src/components/editor/commands/dialog-request.ts";
import { fill, rulesHr as t } from "./messages.hr";
import { setActiveProfile } from "../areas/skeleton/active-profile";
import { AREA_ORDER, DEFAULT_PROFILE_ID, UNITS, profileById, profilesOf, unitById, type RuleProfile } from "./profiles";
import {
  GROUP_ORDER, cardLine, itemsOf, kindText, scopeText, setupOf, tableRow, toggleTick, toolsText, unitsByArea,
  type RuleItem, type Ticks, type WorkStats,
} from "./rules-model";

export type RulesRole = "student" | "teacher" | "collaborator";
type View = "rules" | "faculty" | "table";

export const TOAST_MS = 3200;

type Props = {
  role?: RulesRole;
  /** Submitted or read-only works cannot be changed. */
  readOnly?: boolean;
  stats?: WorkStats | null;
  /** Profile named by the assignment; the general academic work when absent. */
  profileId?: string | null;
};

export function RulesHost({ role = "student", readOnly = false, stats = null, profileId = null }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("rules");
  const [chosen, setChosen] = useState<string>(profileById(profileId)?.id ?? DEFAULT_PROFILE_ID);
  const [ticks, setTicks] = useState<Ticks>({});
  const [unitId, setUnitId] = useState<string>(profileById(chosen)?.unitId ?? "");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const locked = readOnly || role === "collaborator";
  const profile = profileById(chosen);
  const items = useMemo(() => (profile ? itemsOf(profile, stats) : []), [profile, stats]);

  // WEB-DIZ-B-V21: the toolbar (formula, code, "Kostur rada") follows the profile chosen here.
  useEffect(() => {
    if (role !== "student") return;
    setActiveProfile(chosen);
    return () => setActiveProfile(null);
  }, [chosen, role]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const ticked = ticks[chosen] ?? {};
  const close = () => { setOpen(false); setView("rules"); };
  const pick = (next: RuleProfile) => {
    setChosen(next.id);
    setToast(fill(t.faculty.changed, { label: next.label }));
  };

  // ED-60: opened from the view menu (dialog-request), as in the prototype; nothing is drawn under the shell.
  useDialogRequest("rules", () => setOpen(true));

  return (
    <>
      <Dialog
        open={open}
        title={view === "rules" ? t.card.title : view === "faculty" ? t.faculty.title : t.faculty.tableTitle}
        onClose={close}
        actions={<Button tone="quiet" onClick={close}>{view === "rules" ? t.faculty.close : t.faculty.done}</Button>}
      >
        {view === "rules" && profile ? (
          <RulesList profile={profile} items={items} ticked={ticked} locked={locked} role={role} readOnly={readOnly}
            onTick={(key) => setTicks((current) => toggleTick(current, chosen, key))}
            onChange={() => { setUnitId(profile.unitId); setView("faculty"); }} />
        ) : null}
        {view === "faculty" ? (
          <FacultyPicker chosen={chosen} unitId={unitId} query={query} locked={locked} role={role} readOnly={readOnly}
            onQuery={setQuery} onUnit={setUnitId} onPick={pick} onTable={() => setView("table")} />
        ) : null}
        {view === "table" ? (
          <UnitTable onGo={(id) => { setUnitId(id); setView("faculty"); }} onBack={() => setView("faculty")} />
        ) : null}
        <p role="status">{toast}</p>
      </Dialog>
    </>
  );
}

function RulesList({ profile, items, ticked, locked, role, readOnly, onTick, onChange }: {
  profile: RuleProfile; items: readonly RuleItem[]; ticked: Readonly<Record<string, boolean>>;
  locked: boolean; role: RulesRole; readOnly: boolean; onTick: (key: string) => void; onChange: () => void;
}) {
  const done = items.filter((i) => i.state === "ok" || (i.state === "tick" && ticked[i.key]));
  const rest = items.filter((i) => !done.includes(i));
  return (
    <div data-rules="">
      <p>
        <Tag tone={profile.status === "verified" ? "accent" : "neutral"}>{t.list.status[profile.status]}</Tag>{" "}
        {profile.verifiedAt ? fill(t.list.verifiedOn, { date: profile.verifiedAt }) : null}
      </p>
      <p><strong>{profile.label}</strong> · {kindText(profile)}</p>
      <p>{cardLine(items, ticked)}</p>
      <p data-lekta="">{t.lekta.title}: {t.lekta.unavailable}. {t.lekta.note}</p>
      {role === "collaborator" ? <p>{t.role.collaborator}</p> : readOnly ? <p>{t.list.readOnly}</p> : null}
      {GROUP_ORDER.map((group) => {
        const shown = rest.filter((i) => i.group === group);
        if (shown.length === 0) return null;
        const g = t.list.groups[group];
        return (
          <section key={group} aria-label={g.title}>
            <h3>{g.title}</h3>
            {g.note ? <p>{g.note}</p> : null}
            <ul>{shown.map((i) => <RuleRow key={i.key} item={i} ticked={!!ticked[i.key]} locked={locked} onTick={onTick} />)}</ul>
          </section>
        );
      })}
      {done.length > 0 ? (
        <Details summary={fill(t.list.doneGroup, { n: done.length })}>
          <ul>{done.map((i) => <RuleRow key={i.key} item={i} ticked={!!ticked[i.key]} locked={locked} onTick={onTick} />)}</ul>
        </Details>
      ) : null}
      {profile.sources.length > 0 ? (
        <Details summary={fill(t.list.sources, { n: profile.sources.length })}>
          <ul>{profile.sources.map((s) => <li key={s.u}><a href={s.u} target="_blank" rel="noreferrer noopener">{s.t}</a></li>)}</ul>
          <p>{t.list.sourcesNote}</p>
        </Details>
      ) : null}
      <Button tone="quiet" disabled={locked} onClick={onChange}>{t.list.change}</Button>
    </div>
  );
}

function RuleRow({ item, ticked, locked, onTick }: { item: RuleItem; ticked: boolean; locked: boolean; onTick: (key: string) => void }) {
  if (item.state === "tick") {
    return (
      <li>
        <Checkbox label={item.title} hint={item.detail} checked={ticked} disabled={locked} onChange={() => onTick(item.key)} />
      </li>
    );
  }
  return <li><span>{item.title}</span>{item.detail ? <span> · {item.detail}</span> : null}</li>;
}

function FacultyPicker({ chosen, unitId, query, locked, role, readOnly, onQuery, onUnit, onPick, onTable }: {
  chosen: string; unitId: string; query: string; locked: boolean; role: RulesRole; readOnly: boolean;
  onQuery: (q: string) => void; onUnit: (id: string) => void; onPick: (p: RuleProfile) => void; onTable: () => void;
}) {
  const groups = unitsByArea(query, AREA_ORDER);
  const unit = unitById(unitId);
  const profiles = unit ? profilesOf(unit.id) : [];
  const sample = profileById(chosen)?.unitId === unitId ? profileById(chosen) : profiles[0];
  const setup = sample ? setupOf(sample) : null;
  return (
    <div data-faculty="">
      <p>{t.faculty.intro}</p>
      <p>{t.faculty.prototypeNote}</p>
      {role === "collaborator" ? <p>{t.role.collaborator}</p> : readOnly ? <p>{t.faculty.readOnly}</p> : null}
      <label>
        {t.faculty.search}
        <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} />
      </label>
      {groups.length === 0 ? <p>{t.faculty.none}</p> : groups.map((g) => (
        <section key={g.area} aria-label={t.areas[g.area]}>
          <h3>{t.areas[g.area]}</h3>
          <ul>
            {g.units.map((u) => (
              <li key={u.id}>
                <Button tone="quiet" aria-pressed={u.id === unitId} onClick={() => onUnit(u.id)}>{u.name}</Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!unit || !setup ? <p>{t.faculty.choose}</p> : (
        <section aria-label={unit.name}>
          <h3>{unit.name}</h3>
          <p>{fill(t.faculty.area, { name: t.areas[setup.area] })}</p>
          <p>{t.faculty.tools}: {toolsText(setup.tools)}</p>
          <p>{t.faculty.style}: {t.styles[setup.style]} ({t.faculty.styleSource[setup.source === "rule" ? "rule" : setup.source]})</p>
          <p>{t.faculty.format}</p>
          <p>{fill(t.faculty.abbr, { state: setup.abbr ? t.faculty.abbrOn : t.faculty.abbrOff })}</p>
          <h4>{t.faculty.workType}</h4>
          <ul>
            {profiles.map((p) => (
              <li key={p.id}>
                <Button tone="quiet" disabled={locked} aria-pressed={p.id === chosen} onClick={() => onPick(p)}>
                  {kindText(p)}
                </Button>{" "}
                {fill(t.faculty.profileLine, { status: t.list.status[p.status], scope: scopeText(p) })}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button tone="quiet" onClick={onTable}>{t.faculty.all}</Button>
    </div>
  );
}

function UnitTable({ onGo, onBack }: { onGo: (id: string) => void; onBack: () => void }) {
  return (
    <div data-faculty-table="">
      <p>{fill(t.faculty.tableIntro, { n: UNITS.length })}</p>
      {AREA_ORDER.map((area) => (
        <section key={area} aria-label={t.areas[area]}>
          <table>
            <caption>{t.areas[area]}</caption>
            <thead>
              <tr><th scope="col">{t.faculty.colUnit}</th><th scope="col">{t.faculty.colTools}</th><th scope="col">{t.faculty.colStyle}</th><th scope="col">{t.faculty.colProfiles}</th></tr>
            </thead>
            <tbody>
              {UNITS.filter((u) => u.area === area).map((u) => {
                const row = tableRow(u);
                return (
                  <tr key={u.id}>
                    <td><Button tone="quiet" onClick={() => onGo(u.id)}>{u.name}</Button></td>
                    <td>{row.tools}</td>
                    <td>{row.style}{row.star ? " *" : ""}</td>
                    <td>{row.profiles}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      <Button tone="quiet" onClick={onBack}>{t.faculty.back}</Button>
    </div>
  );
}
