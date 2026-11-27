type Task = { id: string; dependsOn: readonly string[] };

function detectCycles(tasks: Task[]): string[] {
    const graph: { [key: string]: string[] } = {};
    const inDegree: { [key: string]: number } = {};

    tasks.forEach(task => {
        graph[task.id] = task.dependsOn;
        task.dependsOn.forEach(dep => {
            if (!graph[dep]) graph[dep] = [];
            graph[dep].push(task.id);
            inDegree[task.id] = (inDegree[task.id] || 0) + 1;
        });
    });

    const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
    const result: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const current = queue.shift()!;
        result.push(current);
        visited.add(current);

        graph[current].forEach(dep => {
            inDegree[dep]--;
            if (inDegree[dep] === 0 && !visited.has(dep)) {
                queue.push(dep);
            }
        });
    }

    if (result.length !== tasks.length) {
        throw new Error('Cyclic dependency detected');
    }

    return result;
}

export function planExecutionBatches(tasks: readonly Task[]): string[][] {
    const sortedTasks = detectCycles(tasks);
    const waves: string[][] = [];
    const taskMap: { [key: string]: boolean } = {};

    sortedTasks.forEach(task => {
        if (!taskMap[task]) {
            waves.push([task]);
            taskMap[task] = true;
        } else {
            let added = false;
            for (const wave of waves) {
                if (wave.every(t => !tasks.find(tsk => tsk.id === tsk.id && tsk.dependsOn.includes(t)))) {
                    wave.push(task);
                    taskMap[task] = true;
                    added = true;
                    break;
                }
            }
            if (!added) {
                waves.push([task]);
            }
        }
    });

    return waves;
}
