---
doc: scope
status: approved
---

# AccessRipple

AccessRipple turns a public website into an interactive map of its pages, controls, observed flows, and accessibility findings. Developers can rotate around the graph, follow what a control leads to, and inspect evidence when a route, request, or accessibility check fails.

## The Unique Kernel

AccessRipple connects issues to the route and interface control where they occur. Instead of a detached warning list, a developer can select a page or button and follow its observed path to a destination, network outcome, or error, alongside accessibility findings and evidence. The graph stays honest about what was observed, inferred, and not tested.

## Who It's For

The learner is the first builder and tester. The intended users are developers who want to understand a website’s structure and behavior, spot accessibility and flow problems, and decide where to fix them.

## The Core Loop

Paste a public website URL, inspect a bounded set of pages and safe interactions, explore a rotatable graph of pages, controls, flows, errors, and accessibility findings, select a node to inspect its evidence and neighbors, make a correction in the site, rescan, and export the graph as an Obsidian-compatible vault.

## Inspiration & Identity

The learner wants an Obsidian-style graph, smooth purposeful animation, and a polished responsive front end. The graph should feel spatial and navigable, including a 360-degree orbit view, while a clear list/2D alternative keeps the information usable without 3D motion. The product should help developers make the web more accessible.

## Why This Matters to the Learner

The learner wants the web to be accessible to everyone and to build toward a professional tool that helps developers understand and solve problems across websites.

## What "Working" Looks Like

A developer submits a public URL, receives a structured report and graph of the pages, controls, observed destinations, runtime errors, and accessibility findings from the pages and safe interactions actually checked, and exports the result as linked Obsidian notes. The developer can select a control node to follow its recorded flow, correct the site, and compare a rescan. The demo should show the central loop in under three minutes.

## The POC Boundary

Build the backend first: safely accept a URL, inspect a small bounded set of public pages, collect page and interactive-control relationships, observe safe navigation/request outcomes and browser errors, run real automated accessibility checks, return evidence-linked graph data through an API, and produce a linked Obsidian-compatible export. Then build the animated React front end with a rotatable graph and accessible 2D/list alternative. Include a built-in checkout fixture so a payment page and buttons can be shown without submitting a real payment.

## Later

- Increase page coverage and safe interaction depth.
- Support sign-in workflows, source-code inspection, more browsers, and broader manual or automated checks.
- Add guided repair integrations and persistent team scan history.

## Explicitly Cut

- Claiming to inspect every page, execute every possible interaction, find every accessibility or application bug, or certify a site.
- Submitting payment, purchasing, sending messages, deleting data, or triggering another consequential action on a scanned site.
- Silently changing code or publishing changes to a live website.
