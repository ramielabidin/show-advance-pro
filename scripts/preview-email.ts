// Renders the day-sheet email template with a fully-populated fixture show
// and writes the HTML + plain-text output to tmp/. Run with:
//
//   npm run preview:email
//
// Open tmp/daysheet-preview.html in a browser to see exactly what recipients
// will see (modulo external font loading — Apple Mail/iOS honor the Google
// Fonts link, Gmail web falls back to the system sans stack). Useful as the
// baseline file to hand to a design iteration — the shape of this output is
// the contract, so changes should restyle rather than restructure.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  renderDaysheetEmail,
  type RenderShow,
} from "../supabase/functions/send-daysheet-email/template.ts";

const sampleShow: RenderShow = {
  artist_name: "Night Protocol",
  venue_name: "Higher Ground Ballroom",
  venue_address: "1214 Williston Rd, South Burlington, VT 05403, United States",
  city: "South Burlington, VT",
  date: "2026-05-14",
  set_length: "75 min",
  schedule_entries: [
    { id: "1", time: "3:00 PM", label: "Load In", is_band: false, sort_order: 1 },
    { id: "2", time: "4:30 PM", label: "Soundcheck - Juice", is_band: false, sort_order: 2 },
    { id: "3", time: "5:00 PM", label: "Load In - Night Protocol", is_band: false, sort_order: 3 },
    { id: "4", time: "6:00 PM", label: "Soundcheck - Night Protocol", is_band: false, sort_order: 4 },
    { id: "5", time: "7:00 PM", label: "Doors", is_band: false, sort_order: 5 },
    { id: "6", time: "7:30 PM", label: "Juice", is_band: false, sort_order: 6 },
    { id: "7", time: "8:20 PM", label: "Night Protocol", is_band: true, sort_order: 7 },
  ],
  dos_contact_name: "Cate Esser",
  dos_contact_phone: "(504) 232-7936",
  departure_time: "8:30 AM",
  departure_notes:
    "Car Squads:\n\nCRV: Rami, XN, Mario\n\nHighlander: Ben, Kamau, Daniel\n\nJT will come to Portland on his own",
  parking_notes:
    "Two bus lanes on WEST side of building next to loading dock door. Shore power available on wall next to parking spot (on when you arrive). Park bus/van in outer bus spot further from venue with nose facing trees. Venue access starts 1 hour before load in. Vehicles must be cleared 1.5 hours after performance for next day bands.",
  load_in_details:
    "Load in cannot begin before 3:00 PM. Venue access begins 1 hour before load in. Short flat push from loading dock to stage. Production crew will assist with load in and load out. Extra hands available upon request (billed back). No in-house loaders.",
  green_room_info:
    "Bands have their own green rooms with shared common space backstage. 2 Green Rooms for Showcase Lounge with adjoining balcony overlooking the Showcase lounge. 2 private/lockable bathrooms backstage shared between 4 green rooms. No showers onsite. Washer/dryer stacked unit available (liquid detergent/pods only). ENTIRE BUILDING IS SMOKE FREE (tobacco/weed/vapes). Do not access other green rooms (those are for ballroom artists).",
  wifi_network: "HGArtists",
  wifi_password: "J@mm!n0ut!",
  hotel_name: "Best Western / Windjammer",
  hotel_address: "1076 Williston Rd, South Burlington, VT 05403",
  hotel_confirmation: "WJ-884213",
  hotel_checkin: "3:00 PM",
  hotel_checkin_date: "2026-05-03",
  hotel_checkout: "11:00 AM",
  hotel_checkout_date: "2026-05-04",
  guest_list_details: JSON.stringify([
    { name: "Jamie Rivers", plusOnes: 1 },
    { name: "Sam Cole", plusOnes: 0 },
    { name: "Alex Trent", plusOnes: 2 },
  ]),
  additional_info:
    "Backline provided: Yamaha Stage Custom kit, 2× Fender Twin, 1× Ampeg SVT-CL. Bring your own cymbals and snare.",
};

const rendered = renderDaysheetEmail(sampleShow, {
  personalMessage:
    "Really excited for this one, team. Let's load in tight and leave the place clean. See everyone at 3.",
});

const outDir = resolve(process.cwd(), "tmp");
mkdirSync(outDir, { recursive: true });

const htmlPath = resolve(outDir, "daysheet-preview.html");
const textPath = resolve(outDir, "daysheet-preview.txt");
writeFileSync(htmlPath, rendered.html);
writeFileSync(textPath, rendered.text);

console.log(`Subject: ${rendered.subject}`);
console.log(`HTML  → ${htmlPath}`);
console.log(`Text  → ${textPath}`);
