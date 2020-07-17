import redis.clients.jedis.Jedis;

/**
 * @description redis工具类
 * @company com.yinhai
 * @author zhoucw
 * @date 2020-07-16 23:06
 * @version v1.0
 */
public class RedisUtil {
    private final static Jedis redisClient = new Jedis("127.0.0.1", 6379);


}
