import { Set } from 'node:util';

function planExecutionBatches(tasks: readonly { id: string; dependsOn: readonly string[] }[]): string[][] {
    const taskMap = new Map<string, { id: string; dependsOn: Set<string> }>();
    const waveMap = new Map<string, Set<string>>();
    const dependencyMap = new Map<string, Set<string>>();

    // Populate taskMap and dependencyMap
    tasks.forEach(task => {
        if (taskMap.has(task.id)) {
            throw new Error(`Duplicate task ID: ${task.id}`);
        }
        taskMap.set(task.id, { id: task.id, dependsOn: new Set(task.dependsOn) });
        task.dependsOn.forEach(dep => {
            dependencyMap.set(dep, (dependencyMap.get(dep) || new Set()).add(task.id));
        });
    });

    // Identify missing dependencies
    for (const [id, { dependsOn }] of taskMap) {
        for (const dep of dependsOn) {
            if (!taskMap.has(dep)) {
                throw new Error(`Missing dependency ID: ${dep}`);
            }
        }
    }

    // Topological sort to determine the order of waves
    const waveIds = Array.from(taskMap.keys());
    const visited = new Set<string>();
    const waveOrder: string[] = [];

    function dfs(taskId: string): void {
        visited.add(taskId);
        for (const dep of dependencyMap.get(taskId) || []) {
            if (!visited.has(dep)) {
                dfs(dep);
            }
        }
        waveOrder.push(taskId);
    }

    waveIds.forEach(taskId => {
        if (!visited.has(taskId)) {
            dfs(taskId);
        }
    });

    // Assign tasks to waves
    waveOrder.forEach(taskId => {
        const task = taskMap.get(taskId)!;
        if (!waveMap.has(taskId)) {
            waveMap.set(taskId, new Set());
        }
        task.dependsOn.forEach(dep => {
            waveMap.get(dep)!.forEach(depTask => {
                waveMap.get(taskId)!.add(depTask);
            });
        });
    });

    // Convert waveMap to string arrays
    const result: string[][] = [];
    waveMap.forEach((tasks, _) => {
        result.push(Array.from(tasks).sort());
    });

    return result;
}
