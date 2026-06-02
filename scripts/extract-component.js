// One-off helper to mechanically extract a dashboard component from page.tsx
// into its own file. Slices the exact text between two markers (no manual
// copy), writes it to outFile with an import header, and removes it from
// page.tsx. Configure the CONFIG block, then: node scripts/extract-component.js
const fs = require("fs");
const PAGE = "app/dashboard/page.tsx";

// ----- CONFIG (edit per component) -----
const startMarker = `/* ============================================================
   BOOKINGS PAGE
============================================================ */
`;
const endMarker = null; // null = slice to end of file
const outFile = "app/dashboard/components/BookingsPage.tsx";
const importHeader = `"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/Icons";
import { TODAY_STR, type Booking } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { type LookupItem } from "@/lib/api";
import { urgencyOf, tierOf, statusNameToEnum, pShortName, pLoc, formatDateShort, type BookingFilter } from "../_lib";
import { CHANNEL_ICON } from "./ChannelIcon";

`;
// ----- END CONFIG -----

let src = fs.readFileSync(PAGE, "utf8");
// Match the file's actual line endings (page.tsx is CRLF on Windows).
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const sm = startMarker.replace(/\n/g, eol);
const em = endMarker ? endMarker.replace(/\n/g, eol) : null;
const hdr = importHeader.replace(/\n/g, eol);

const start = src.indexOf(sm);
if (start === -1) { console.error("START MARKER NOT FOUND"); process.exit(1); }
const bodyStart = start + sm.length;
const end = em ? src.indexOf(em, bodyStart) : src.length;
if (em && end === -1) { console.error("END MARKER NOT FOUND"); process.exit(1); }

const comp = src.slice(bodyStart, end).replace(/^\s+/, "").replace(/\s+$/, eol);
fs.writeFileSync(outFile, hdr + "export " + comp);

let newSrc = src.slice(0, start) + src.slice(end);
newSrc = newSrc.replace(new RegExp(`(${eol}){3,}`, "g"), eol + eol);
fs.writeFileSync(PAGE, newSrc);
console.log("Extracted", outFile, "| chars:", comp.length, "| page.tsx now:", newSrc.split("\n").length, "lines");
