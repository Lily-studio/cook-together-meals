<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the public homepage’s premium dimensional presentation CSS-driven and isolated to the landing route so authenticated app behavior remains unchanged.
- Mount one persistent Lily conversation view in the root assistant host; the Talk route and floating panel reuse it so hiding or navigating never forks conversation state or cancels active actions.
- Derive assistant page context in the browser and pass it through the existing authenticated Lily command; never create a second assistant endpoint or conversation store.
