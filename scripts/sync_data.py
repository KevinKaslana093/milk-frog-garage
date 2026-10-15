from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
data={k:json.loads((root/'data'/f).read_text(encoding='utf-8')) for k,f in [('parts','parts.json'),('blueprint','starter_blueprint.json'),('levels','levels.json')]}
(root/'src'/'data.js').write_text('/* 自动由 data/*.json 生成，请修改 JSON 后重新运行脚本。 */\nwindow.NAIWA_CONFIG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Synced: src/data.js')
