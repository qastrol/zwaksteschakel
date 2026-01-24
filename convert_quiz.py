import re

input_file = "quizvragen.txt"
output_file = "quizvragen.js"

questions = []

with open(input_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = re.findall(r'\[([^\]]+)\]', line)
        if parts:
            answers = [a.strip() for a in parts]
            question_text = re.sub(r'\[.*?\]', '', line).strip()
            questions.append({"question": question_text, "answers": answers})

with open(output_file, "w", encoding="utf-8") as f:
    f.write("const quizQuestions = [\n")
    for q in questions:
        f.write(f"  {{question: {repr(q['question'])}, answers: {repr(q['answers'])}}},\n")
    f.write("];\n")
