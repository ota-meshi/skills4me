# skills4me

[![npm version](https://img.shields.io/npm/v/skills4me.svg)](https://www.npmjs.com/package/skills4me)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md)

**自作の Agent Skills を Git で管理して、すべてのコーディングエージェントで使う。**

skills4me は、Git チェックアウト内のスキルを、Claude Code、Codex、Cursor、Gemini CLI ほか 70 以上のコーディングエージェントのユーザーレベルのスキルディレクトリにリンクします。

![`npx skills4me link` で、~/my-skills と ~/work-skills のスキルを Claude Code、Codex、Cursor、Gemini CLI、GitHub Copilot ほか 70 のエージェントのスキルディレクトリにリンクする図](docs/images/how-it-works.svg)

- **その場で編集できる。** エージェントはリンク経由でチェックアウトを読むため、編集は入れ直さずに反映されます。
- **一つのコマンドで全エージェントに。** `link` で、選んだすべてのエージェントにスキルを配置します。
- **準備がいらない。** 設定ファイルも事前登録も中央管理用のディレクトリも不要です。個人用と仕事用のスキルを別々のチェックアウトに分けられます。
- **既存のスキルも Git 管理に取り込める。** `adopt` でエージェントのディレクトリにあるスキルをチェックアウトに移し、元の場所にリンクを残します。

## クイックスタート

Node.js 22 以降が必要です。

Git チェックアウトの `skills/<名前>/` にスキルを一つずつ置きます。

```text
my-skills/
└── skills/
    ├── commit-message/
    │   └── SKILL.md
    └── review-pr/
        ├── SKILL.md
        └── checklist.md
```

チェックアウト内で実行します。

```sh
npx skills4me link
```

一覧からエージェントを選びます。検出したエージェントは最初から選ばれています。各スキルが選んだエージェントのスキルディレクトリにリンクされます。

```text
Linked ~/.claude/skills/commit-message -> ~/my-skills/skills/commit-message
Linked ~/.claude/skills/review-pr -> ~/my-skills/skills/review-pr
Linked ~/.agents/skills/commit-message -> ~/my-skills/skills/commit-message
Linked ~/.agents/skills/review-pr -> ~/my-skills/skills/review-pr
```

エージェントのスキルディレクトリからリンク経由で編集しても、変更されるのはチェックアウトのファイルです。Git に残すには普段どおりコミットします。

対話端末で `npx skills4me` をコマンドなしで実行するとメニューからコマンドを選べます。ヘルプは `npx skills4me --help` で表示できます。

## チェックアウトのスキルを使う

- 関連ファイルは `SKILL.md` と同じディレクトリに置きます。スキルが一つだけなら `skills/SKILL.md` に直接置くこともできます。この場合、配置先に `skills` という名前のリンクができます。
- 対話端末では、対応するすべてのエージェントが一覧に表示されます。対話端末でなければ、検出したすべてのエージェントにリンクします。
- 選択画面を省くには、`npx skills4me link --agent claude-code --agent cursor` のように `--agent` で指定します。自動検出されなかったエージェントも指定できます。指定できる名前は `npx skills4me link --help` で確認できます。
- スキルディレクトリを追加・改名・削除したら `link` を再実行します。改名・削除したスキルのリンクは削除されます。
- 同名の既存スキルはそのまま残り、競合が表示されます。
- 複数のチェックアウトを使うには、それぞれで `link` を実行します。別の場所からは `npx skills4me link <ディレクトリ>` で指定できます。チェックアウトの外でパスを省略すると、対話端末ではディレクトリを選べます。

## 既存のスキルを Git 管理に取り込む

取り込み候補を確認します。リンクは候補に含まれません。対応する記録がない外部スキルも候補に出る場合があるため、取り込むスキルは一覧を確認して選んでください。

```sh
npx skills4me detect
```

取り込み先のチェックアウト内で、対話端末から実行してスキルを選びます。

```sh
npx skills4me adopt
```

- スキル一式はチェックアウトの `skills/` に移り、元の場所にはリンクが残ります。取り込んだファイルは普段どおりコミットできます。
- 別の場所から実行する場合は `--to <ディレクトリ>` で取り込み先を指定できます。
- 取り込み先に `skills/SKILL.md` を使った単体スキルがある場合は、先にそのスキルのファイルを `skills/<名前>/` に移してください。
- `detect` と `adopt` でも `--agent` を指定でき、そのエージェントのスキルディレクトリだけを探します。

## 既存ツールとの違い

外部スキルには今のインストーラーを使い、自作スキルは skills4me で管理できます。

|                                                                         | ローカルのスキル                     | スキルを編集したあと |
| ----------------------------------------------------------------------- | ------------------------------------ | -------------------- |
| `skills4me link`                                                        | Git チェックアウト内の原本へのリンク | 何もしなくてよい     |
| Vercel の [`skills add`](https://www.skills.sh/docs/cli)                | コピー                               | 入れ直す             |
| [`openskills install`](https://github.com/numman-ali/openskills#readme) | コピー                               | 入れ直す             |

`adopt` は、`skills` のロックファイルや openskills に記録されたスキルを候補から外すため、それらのツールが管理するスキルを横取りしません。
