# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "ページが見つかりません" [level=2] [ref=e5]
    - paragraph [ref=e6]: お探しのページは存在しないか、移動された可能性があります。
    - generic [ref=e7]:
      - link "ホームに戻る" [ref=e8] [cursor=pointer]:
        - /url: /
      - link "前のページに戻る" [ref=e9] [cursor=pointer]:
        - /url: /
  - region "Notifications (F8)":
    - list
```