"use client";

import { Button } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import styles from "./Home.module.css";
import { CODE_MAX } from "../enrol/code";
import { homeText as t } from "./messages.hr";
import { enrollRoute } from "./model";

/**
 * The code form of the prototype (`codeForm()`, R-10): nothing is sent from here.
 * The code, cleaned by the one rule of P-11, goes to E-5 where the field is already filled.
 */
export function CodeForm() {
  const { base } = useHost();
  const router = useRouter();
  const [code, setCode] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(nextPath(base, enrollRoute(code)));
  }
  return (
    <form className={styles.code} onSubmit={submit} noValidate>
      <input className={styles.codeInput} name="kod" aria-label={t.codeLabel} placeholder={t.codePlaceholder}
        autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={CODE_MAX} value={code}
        onChange={(event) => setCode(event.target.value)} />
      <Button type="submit">{t.codeSubmit}</Button>
    </form>
  );
}

/** `Imate kod novog kolegija?` with its form (`codeCard()`). */
export function CodeCard() {
  return (
    <section className={`${styles.card} ${styles.center}`} aria-labelledby="po-k">
      <h3 id="po-k">{t.codeHeading}</h3>
      <CodeForm />
    </section>
  );
}
