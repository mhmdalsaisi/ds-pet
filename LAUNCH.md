# DeepSeek Pet launch kit

Repository: https://github.com/zhaoryder/ds-pet

## One-day launch order

1. DeepSeek Harness Discord — the most relevant audience. Post in the channel intended for projects, plugins, or showcases.
2. Show HN — use the English copy below and stay available to answer technical questions.
3. r/DeepSeek — recent DSH/tool posts show a directly relevant audience. Follow the subreddit rules and use one useful showcase post.
4. V2EX or Linux.do — publish one Chinese post, not duplicates across many sections.
5. X / Bluesky — attach `assets/marketing/social-preview.jpg` and the demo GIF from the README.
6. Reply to every genuine question with technical detail. Do not ask for stars; ask people to try it and report problems.

## DeepSeek Harness Discord

I made DeepSeek Pet, a small open-source desktop companion for DSH.

It turns DSH activity into a cartoon pet with visible working, planning, completed, and offline states. It can also start `dsh web` from the offline panel. Windows, macOS, and Linux builds are available.

I built it because terminal sessions are easy to lose track of when several tasks are running. Feedback on the status mapping and Windows launcher would be especially useful:

https://github.com/zhaoryder/ds-pet

## Show HN

Title:

> Show HN: DeepSeek Pet – a desktop companion for DeepSeek Harness

Body:

> DeepSeek Pet is an open-source desktop companion for DeepSeek Harness (DSH). It turns session activity into a small cartoon pet, with distinct states for working, planning, completion, and offline mode.
>
> The app runs on Windows, macOS, and Linux. When DSH is offline, the panel can launch `dsh web` and open the local dashboard. The interface follows the system language and includes several selectable pet styles.
>
> I made it because I wanted an ambient way to notice what my DSH sessions were doing without repeatedly checking a terminal window.
>
> Repo and downloads: https://github.com/zhaoryder/ds-pet
>
> I would especially appreciate feedback on the status model, packaging, and whether this is useful with multiple concurrent sessions.

## Chinese community post

Title:

> 做了一个会显示 DSH 状态的开源桌宠：DeepSeek Pet

Body:

> 最近做了个小工具 DeepSeek Pet，把 DeepSeek Harness 的运行状态变成桌面上的卡通桌宠。
>
> 它会区分工作、规划、完成和离线状态；离线时也能从面板启动 `dsh web`。目前有 Windows、macOS 和 Linux 安装包，界面会跟随系统语言，还能切换不同桌宠风格。
>
> 起因很简单：任务一多，我总要切回终端确认有没有跑完。现在看一眼桌面就知道了。
>
> 项目和下载：https://github.com/zhaoryder/ds-pet
>
> 欢迎试用，尤其想听听 Windows 启动和状态识别有没有问题。

## Reddit r/DeepSeek

Title:

> I made a desktop pet that shows what my DeepSeek Harness sessions are doing

Body:

> I kept losing track of whether a DSH session was still working, waiting for approval, or already finished, so I made a small open-source desktop companion for it.
>
> DeepSeek Pet shows those states as a cartoon whale and supports Windows, macOS, and Linux. It also has an offline action to start `dsh web`, plus selectable pet styles and English/Chinese UI.
>
> Demo and installers: https://github.com/zhaoryder/ds-pet
>
> I’m looking for practical feedback, especially from people running more than one DSH session: are the states useful, and what should the pet show next?

Do not cross-post this unchanged to multiple Reddit communities. Check the current subreddit rules and disclose that you are the maker.

## X / Bluesky

> I built DeepSeek Pet: an open-source desktop companion that turns DeepSeek Harness activity into a cartoon pet. Working, planning, completed, and offline states; Windows, macOS, and Linux builds. Feedback welcome: https://github.com/zhaoryder/ds-pet

## Reply snippets

- Packaging issue: “Thanks — which OS, version, and installer did you use? I’ll reproduce it.”
- DSH detection issue: “Could you share the output of `dsh --version` and whether `dsh web` works directly in your terminal?”
- Feature request: “That fits the project. Please open an issue with the workflow you want; I’ll use it to shape the next release.”

## Guardrails

- Do not buy stars, exchange stars, use bots, or mass-DM strangers.
- Do not cross-post identical text into multiple sections of the same community.
- Lead with the demo and the problem it solves. Let readers decide whether to star it.
