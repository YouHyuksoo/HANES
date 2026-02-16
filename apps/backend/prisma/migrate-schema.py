"""
Schema migration script: Add company, plant, createdBy, updatedBy to all models.
Line-based parsing to handle nested braces correctly.
"""
import re

schema_path = 'schema.prisma'
with open(schema_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_cols = [
    ('company',   '  company     String?   @map("company")                    // 회사코드\n'),
    ('plant',     '  plant       String?   @map("plant_cd")                   // 공장코드\n'),
    ('createdBy', '  createdBy   String?   @map("created_by")                 // 생성자\n'),
    ('updatedBy', '  updatedBy   String?   @map("updated_by")                 // 수정자\n'),
]

# Parse models: find model start/end, find createdAt line
models = []
i = 0
while i < len(lines):
    line = lines[i]
    m = re.match(r'^model\s+(\w+)\s*\{', line)
    if m:
        model_name = m.group(1)
        start = i
        brace_count = 1
        j = i + 1
        created_at_line = None
        existing_cols = set()
        while j < len(lines) and brace_count > 0:
            brace_count += lines[j].count('{') - lines[j].count('}')
            if 'createdAt' in lines[j] and '@map' in lines[j]:
                created_at_line = j
            # Check existing columns
            for col_name, _ in new_cols:
                if re.search(rf'\b{col_name}\b', lines[j]):
                    existing_cols.add(col_name)
            j += 1
        end = j - 1  # closing brace line
        models.append({
            'name': model_name,
            'start': start,
            'end': end,
            'created_at_line': created_at_line,
            'existing_cols': existing_cols,
        })
    i += 1

print(f"Total models found: {len(models)}")

# Build insert plan (process in reverse to preserve line numbers)
inserts = []
for model in models:
    missing = [(name, defn) for name, defn in new_cols if name not in model['existing_cols']]
    if not missing:
        continue
    insert_at = model['created_at_line'] if model['created_at_line'] else model['end']
    joined = ", ".join([m[0] for m in missing])
    print(f"  {model['name']}: +{len(missing)} ({joined}) at line {insert_at}")
    inserts.append((insert_at, missing))

# Apply inserts in reverse order to preserve line numbers
inserts.sort(key=lambda x: x[0], reverse=True)
for insert_at, missing_cols in inserts:
    insert_block = [defn for _, defn in missing_cols]
    for col_line in reversed(insert_block):
        lines.insert(insert_at, col_line)

with open(schema_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\nTotal inserts: {len(inserts)} models updated")
print("Schema updated successfully!")
