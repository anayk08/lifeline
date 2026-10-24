// <!-- REVIEW WITH LAWYER -->
// Open-source software, fonts, icons and data used in the app, with their licenses.
// Keep in sync with package.json "dependencies" (only code that ships to the browser is listed).
import { Card, Doc, Ext, H, P } from "./parts";

const SOFTWARE: [name: string, license: string, url: string][] = [
  ["React and React DOM 18", "MIT", "https://github.com/facebook/react/blob/main/LICENSE"],
  ["Leaflet 1.9", "BSD 2-Clause", "https://github.com/Leaflet/Leaflet/blob/main/LICENSE"],
  ["React Leaflet 4 and @react-leaflet/core", "Hippocratic License 2.1", "https://github.com/PaulLeCam/react-leaflet/blob/master/LICENSE.md"],
  ["AWS Amplify JavaScript library", "Apache 2.0", "https://github.com/aws-amplify/amplify-js/blob/main/LICENSE"],
  ["Workbox (offline support)", "MIT", "https://github.com/GoogleChrome/workbox/blob/v7/LICENSE"],
];

const ASSETS: [name: string, license: string, url: string][] = [
  ["Inter typeface (Rasmus Andersson)", "SIL Open Font License 1.1", "https://github.com/rsms/inter/blob/master/LICENSE.txt"],
  ["Material Symbols (Google)", "Apache 2.0", "https://github.com/google/material-design-icons/blob/master/LICENSE"],
  ["Line icons from the team’s Figma design, in the style of Lucide", "ISC (Lucide)", "https://lucide.dev/license"],
];

const DATA: [name: string, license: string, url: string][] = [
  ["Map images, map data and the San José city outline: © OpenStreetMap contributors", "Open Database License (ODbL)", "https://www.openstreetmap.org/copyright"],
  ["Earthquake data: U.S. Geological Survey", "U.S. public domain", "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits"],
  ["Weather alerts: National Weather Service", "U.S. public domain", "https://www.weather.gov/disclaimer"],
  ["Wildfire incidents: CAL FIRE", "Public information", "https://www.fire.ca.gov/"],
  ["Safety steps adapted from Ready.gov (FEMA) and the National Weather Service", "U.S. public domain", "https://www.ready.gov/"],
  ["Safety steps adapted from the American Red Cross, with credit", "© American Red Cross", "https://www.redcross.org/"],
];

function Group({ title, items }: { title: string; items: [string, string, string][] }) {
  return (
    <>
      <H>{title}</H>
      {items.map(([name, license, url]) => (
        <Card key={name}>
          <p className="font-semibold">{name}</p>
          <p className="text-[0.875rem]">
            <Ext href={url}>{license}</Ext>
          </p>
        </Card>
      ))}
    </>
  );
}

export default function Licenses() {
  return (
    <Doc title="Open-source licenses & credits">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <P>Lifeline is built with these projects and data sources. Thank you to everyone who makes them.</P>
      <Group title="Software" items={SOFTWARE} />
      <Group title="Fonts and icons" items={ASSETS} />
      <Group title="Data" items={DATA} />
      <P>The Lifeline logo, car-with-bolt icon and app design were made by the Lifeline team.</P>
    </Doc>
  );
}
