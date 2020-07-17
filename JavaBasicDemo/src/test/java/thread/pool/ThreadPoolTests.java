package thread.pool;

import org.junit.Test;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static java.lang.Thread.*;

/**
 * @description 线程池demo测试类
 * @company com.yinhai
 * @author zhoucw
 * @date 2020-07-16 23:23
 * @version v1.0
 */
public class ThreadPoolTests {

    @Test
    public void threaPoolOne() {
        /*
          线程池实现方式2 - newSingleThreadExecutor
          只有一个线程，如果关闭了就会新建一个线程补位
         */
        ExecutorService threadPool = null;
        try {
            threadPool = Executors.newSingleThreadExecutor();
            for (int i = 0; i < 10; i++) {
                final int finalI = i;
                threadPool.execute(new Runnable() {
                    public void run() {
                        System.out.println(currentThread().getName() +
                                "===" +
                                finalI);
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (null != threadPool) {
                // XXX 一定要关闭线程池
                threadPool.shutdown();
            }
        }
    }

    @Test
    public void threadPoolTwo() {
        /*
            线程池实现方式3 - newFixedThreadPool
            可指定固定的线程数，线程池始终保持固定数量的线程
        */
        ExecutorService threadPool = null;
        try {
            threadPool = Executors.newFixedThreadPool(5);
            for (int i = 0; i < 10; i++) {
                final int finalI = i;
                threadPool.execute(new Runnable() {
                    public void run() {
                        System.out.println(currentThread().getName() +
                                "===" +
                                finalI);
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            /* XXX 一定关闭线程池 */
            if (null != threadPool) {
                threadPool.shutdown();
            }
        }
    }

    @Test
    public void threadPoolThree() {
        /*
            线程池实现方式4 - newCachedThreadPool
            初始线程为0，按需创建线程，如果有空闲就使用，没有就新建线程，同时如果
            超过60s线程闲置就关闭线程
        */
        ExecutorService threadPool = null;
        try {
            threadPool = Executors.newCachedThreadPool();
            for (int i = 0; i < 10; i++) {
                final int finalI = i;
                threadPool.execute(new Runnable() {
                    public void run() {
                        System.out.println(currentThread().getName() +
                                "===" +
                                finalI);
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            // XXX 一定关闭线程池
            if (null != threadPool) {
                threadPool.shutdown();
            }
        }
    }

    @Test
    public void threadPoolFour() {
        /*
            线程池实现方式4 - newScheduledThreadPool
            可以延迟执行或者定时执行的线程
        */
        ExecutorService threadPool = null;
        try {
            threadPool = Executors.newScheduledThreadPool(10);
            for (int i = 0; i < 10; i++) {
                final int finalI = i;
                threadPool.execute(new Runnable() {
                    public void run() {
                        System.out.println(currentThread().getName() +
                                "===" +
                                finalI);
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (null != threadPool) {
                // XXX 一定关闭线程池
                threadPool.shutdown();
            }
        }
    }
}
