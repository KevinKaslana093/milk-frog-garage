# 角色素材记录

用户于本次会话确认：图1无蝴蝶结=奶蛋；图2黄色蝴蝶结=奶豆。没有使用压缩包中其他角色作为替代。

- `naidan.png`：从用户第一张截图进行背景提取的衍生图。
- `naidou.png`：从用户第二张截图进行背景提取的衍生图。
- 工具：内置 image_gen，transparent_background=true。非 CLI/API 路径。
- 编辑目的：移除手机截图边框、UI、背景和地面阴影，保留原角色体型、五官、颜色、材质与神态。
- 说明：这是生成式高保真背景提取，并非逐像素无损抠图。角色图用于本项目；未额外复制第三方游戏人物。
- 游戏内仅根据车身加速度做不同步轻微晃动，不改变原图表情，不添加新配饰。

## 实际提示词

奶蛋：

Use case: background-extraction. Edit target: supplied screenshot containing a yellow egg-shaped toy character. Extract ONLY this EXACT yellow character into a transparent PNG game sprite. Remove all screenshot UI, black/gray borders, white backdrop and floor shadow. Preserve the actual reference character: plump pear/egg body, smooth soft yellow 3D rubber surface, green irises and black pupils, tiny subtle smiling mouth, no arms, no feet, no bow. Do NOT redesign, simplify, vectorize, cartoonize or change proportions or expression. Full body centered with 6% transparent margin. The requested output is the original-looking isolated subject, not a new character.

奶豆：

Use case: background-extraction. Edit target: supplied phone screenshot of the yellow round toy with a yellow bow. Extract ONLY this EXACT character as a transparent PNG game sprite. Remove screenshot UI, white backdrop, floor shadow, usernames and borders. Keep the original plump ROUND silhouette, two tiny stubby feet, large yellow fabric-like bow, large pale green-grey irises and black pupils, tiny DOWNCURVED unhappy mouth, soft yellow 3D toy material and original face. Do NOT redesign or simplify. No new accessories, no arms, no eyelashes, no smile. Keep all of the bow and feet fully visible. Center full character with 6% transparent margin. Original-character cutout for a game, not a new illustration.

## 其他资源

地形、零件、天空、远山、风车、小屋、桥台、星星与界面由本项目代码原创绘制，不含捣蛋猪图片。字体使用系统字体。音效使用 Web Audio 合成，不依赖外部录音。
