import { Set } from 'core-js';

function planExecutionBatches(tasks: readonly { id: string; dependsOn: readonly string[] }[]): string[][] {
    const taskMap = new Map<string, { id: string; dependsOn: Set<string> }>();
    const dependencyMap = new Map<string, Set<string>>();
    const result: string[][] = [];

    // Populate taskMap and dependencyMap
    tasks.forEach(task => {
        if (taskMap.has(task.id)) {
            throw new Error(`Duplicate task ID: ${task.id}`);
        }
        taskMap.set(task.id, { id: task.id, dependsOn: new Set(task.dependsOn) });
        task.dependsOn.forEach(dep => {
            if (!taskMap.has(dep)) {
                throw new Error(`Missing dependency ID: ${dep}`);
            }
            if (!dependencyMap.has(dep)) {
                dependencyMap.set(dep, new Set());
            }
            dependencyMap.get(dep)!.add(task.id);
        });
    });

    // Topological sort
    const visited = new Set<string>();
    const stack: string[] = [];

    function dfs(taskId: string) {
        if (visited.has(taskId)) return;
        visited.add(taskId);
        taskMap.get(taskId)!.dependsOn.forEach(dep => dfs(dep));
        stack.push(taskId);
    }

    taskMap.forEach(task => dfs(task.id));

    // Group tasks into batches
    while (stack.length > 0) {
        const batch: string[] = [];
        const currentTaskId = stack.pop()!;
        batch.push(currentTaskId);
        dependencyMap.get(currentTaskId)?.forEach(dep => {
            if (stack.includes(dep)) {
                throw new Error(`Cyclic dependency detected involving task: ${dep}`);
            }
            stack.splice(stack.indexOf(dep), 1);
            batch.push(dep);
        });
        result.unshift(batch.sort());
    }

    return result;
}

export { planExecutionBatches };
